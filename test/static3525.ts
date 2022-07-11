import { ethers, network } from "hardhat";
import {
  TestERC20,
  TestERC3525,
  WyvernExchange,
  WyvernRegistry,
  WyvernStatic,
} from "../typechain";
import { Contract } from "ethers";
import WyvernStaticBin from "../artifacts/contracts/WyvernStatic.sol/WyvernStatic.json";
import TestErc20Bin from "../artifacts/contracts/TestERC20.sol/TestERC20.json";
import TestErc3525Bin from "../artifacts/contracts/TestERC3525/TestERC3525.sol/TestERC3525.json";

describe("Exchange", function () {
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const ZERO_BYTES32 =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const NULL_SIG = { v: 27, r: ZERO_BYTES32, s: ZERO_BYTES32 };

  const eip712Order = {
    name: "Order",
    fields: [
      { name: "registry", type: "address" },
      { name: "maker", type: "address" },
      { name: "staticTarget", type: "address" },
      { name: "staticSelector", type: "bytes4" },
      { name: "staticExtradata", type: "bytes" },
      { name: "maximumFill", type: "uint256" },
      { name: "listingTime", type: "uint256" },
      { name: "expirationTime", type: "uint256" },
      { name: "salt", type: "uint256" },
    ],
  };

  const parseSig = (bytes: string) => {
    bytes = bytes.substr(2);
    const r = "0x" + bytes.slice(0, 64);
    const s = "0x" + bytes.slice(64, 128);
    const v = parseInt("0x" + bytes.slice(128, 130), 16);
    return { v, r, s };
  };

  const deployCoreContracts = async () => {
    const registryFactory = await ethers.getContractFactory("WyvernRegistry");
    const registryC = (await registryFactory.deploy()) as WyvernRegistry;
    await registryC.deployed();
    console.log("registry deployed, address", registryC.address);

    const atomicizerFactory = await ethers.getContractFactory(
      "WyvernAtomicizer"
    );
    const atomicizerC = await atomicizerFactory.deploy();
    await atomicizerC.deployed();
    console.log("atomicizer deployed, address", atomicizerC.address);

    const staticFactory = await ethers.getContractFactory("WyvernStatic");
    const staticC = (await staticFactory.deploy(
      atomicizerC.address
    )) as WyvernStatic;
    await staticC.deployed();
    console.log("static deployed, address", staticC.address);

    const exchangeFactory = await ethers.getContractFactory("WyvernExchange");
    const exchangeC = (await exchangeFactory.deploy(
      network.config.chainId,
      [registryC.address],
      "0x"
    )) as WyvernExchange;
    await exchangeC.deployed();
    console.log("exchange deployed, address", exchangeC.address);

    await registryC.grantInitialAuthentication(exchangeC.address);
    console.log("grantInitialAuthentication to exchange OK", exchangeC.address);

    return { registryC, atomicizerC, staticC, exchangeC };
  };

  const deployContracts = async (contract: string): Promise<Contract> => {
    const factory = await ethers.getContractFactory(contract);
    const c = (await factory.deploy()) as Contract;
    await c.deployed();
    return c;
  };

  it("matches erc3525 <> erc20 signed orders, matched right, real static call", async function () {
    console.log("network chainId", network.config.chainId);
    const [user1, user2] = await ethers.getSigners();
    const price = 10000;
    const slot = 999;
    const tokenId = 4;
    const maximumSellValue = 100;
    const sellValue = 15;

    const { registryC, atomicizerC, staticC, exchangeC } =
      await deployCoreContracts();
    const erc3525C = (await deployContracts("TestERC3525")) as TestERC3525;
    const erc20C = (await deployContracts("TestERC20")) as TestERC20;
    console.log("deploy contracts ERC20 && ERC3525 success");

    await (await registryC.connect(user1)).registerProxy();
    const proxy1 = await registryC.proxies(user1.address);
    await (await registryC.connect(user2)).registerProxy();
    const proxy2 = await registryC.proxies(user2.address);
    console.log("register proxies success");

    await (await erc3525C.connect(user1)).mint(slot, tokenId, maximumSellValue);
    await (
      await erc20C.connect(user2)
    ).mint(user2.address, maximumSellValue * price);
    console.log("mint success");

    await (await erc3525C.connect(user1)).setApprovalForAll(proxy1, true);
    await (
      await erc20C.connect(user2)
    ).approve(proxy2, maximumSellValue * price);
    console.log("approve success");

    // list
    const staticInterface = new ethers.utils.Interface(WyvernStaticBin.abi);
    const selectorOne = staticInterface.getSighash("splitAddOne");
    console.log("selectorOne: splitAddOne", selectorOne);
    const selectorOneA = staticInterface.getSighash("sequenceExact");
    console.log("selectorOneA: sequenceExact", selectorOneA);
    const selectorOneB = staticInterface.getSighash("sequenceExact");
    console.log("selectorOneB: sequenceExact", selectorOneB);

    // abi for WyvernAtomicizer::atomicize
    const abi = [
      {
        constant: false,
        inputs: [
          { name: "addrs", type: "address[]" },
          { name: "values", type: "uint256[]" },
          { name: "calldataLengths", type: "uint256[]" },
          { name: "calldatas", type: "bytes" },
        ],
        name: "atomicize",
        outputs: [],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
    ];
    const atomicizerInterface = new ethers.utils.Interface(abi);

    const aEDParams = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "uint256"],
      [erc3525C.address, tokenId, maximumSellValue]
    );
    console.log(
      `aEDParams(erc3525.address, tokenId, maximumSellValue): ${aEDParams}(${erc3525C.address}, ${tokenId}, ${maximumSellValue})`
    );
    const aEDSelector = staticInterface.getSighash("transferERC3525Exact");
    console.log("aEDSelector:transferERC3525Exact", aEDSelector);

    const erc20Amount = maximumSellValue * price;
    const bEDParams = ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256"],
      [erc20C.address, erc20Amount]
    );
    console.log(
      `bEDParams(address,uint256): ${bEDParams}(${erc20C.address}, ${erc20Amount})`
    );
    const bEDSelector = staticInterface.getSighash("transferERC20Exact");
    console.log("bEDSelector:transferERC20Exact", bEDSelector);

    const extradataOneA = ethers.utils.defaultAbiCoder.encode(
      ["address[]", "uint256[]", "bytes4[]", "bytes"], // TODO: for what
      [
        [staticC.address],
        [(aEDParams.length - 2) / 2],
        [aEDSelector],
        aEDParams,
      ]
    );
    console.log(
      `extradataOneA(address[],uint256[],bytes4[],bytes): ${extradataOneA}(${
        staticC.address
      }, ${(aEDParams.length - 2) / 2}, ${aEDSelector}, ${aEDParams})`
    );

    const extradataOneB = ethers.utils.defaultAbiCoder.encode(
      ["address[]", "uint256[]", "bytes4[]", "bytes"],
      [
        [staticC.address],
        [(bEDParams.length - 2) / 2],
        [bEDSelector],
        bEDParams,
      ]
    );
    console.log(
      `extradataOneB(address[],uint256[],bytes4[],bytes): ${extradataOneB}(${
        staticC.address
      }, ${(bEDParams.length - 2) / 2}, ${bEDSelector}, ${bEDParams})`
    );

    const paramsOneA = ethers.utils.defaultAbiCoder.encode(
      ["address[2]", "bytes4[2]", "bytes", "bytes"],
      [
        [staticC.address, staticC.address],
        [selectorOneA, selectorOneB],
        extradataOneA,
        extradataOneB,
      ]
    );
    console.log(
      `paramsOneA(address[2],bytes4[2],bytes,bytes): ${paramsOneA}(${staticC.address}, ${selectorOneA}, ${extradataOneA}, ${extradataOneB})`
    );

    const one = {
      registry: registryC.address,
      maker: user1.address,
      staticTarget: staticC.address,
      staticSelector: selectorOne,
      staticExtradata: paramsOneA,
      maximumFill: "" + maximumSellValue,
      listingTime: "0",
      expirationTime: "10000000000",
      salt: "3358",
    };
    console.log("one", one);
    const typedData = {
      name: eip712Order.name,
      fields: eip712Order.fields,
      domain: {
        name: "Wyvern Exchange",
        version: "3.1",
        chainId: network.config.chainId,
        verifyingContract: exchangeC.address,
      },
      data: one,
    };
    console.log("str", typedData);

    const sig = await user1._signTypedData(
      typedData.domain,
      { Order: eip712Order.fields },
      one
    );
    console.log("one sig", sig);
    const listOrderSignedData: any = parseSig(sig);
    console.log("sig rsv", listOrderSignedData);

    // trade
    const selectorTwo = staticInterface.getSighash("anyAddOne");
    console.log("selectorTwo", selectorTwo);
    const extradataTwo = "0x";
    console.log("extradataTwo", extradataTwo);

    const two = {
      registry: registryC.address,
      maker: user2.address,
      staticTarget: staticC.address,
      staticSelector: selectorTwo,
      staticExtradata: extradataTwo,
      maximumFill: "" + sellValue * 2,
      listingTime: "0",
      expirationTime: "10000000000",
      salt: "20",
    };
    console.log("two", two);

    const erc3525Interface = new ethers.utils.Interface(TestErc3525Bin.abi);
    const transferFromFragment = erc3525Interface.getFunction(
      "safeTransferFrom(address,address,uint256,uint256,bytes)"
    );
    console.log(
      "erc3525 transferFromFragment: safeTransferFrom",
      transferFromFragment
    );

    const firstErc3525Call =
      erc3525Interface.encodeFunctionData(transferFromFragment, [
        user1.address,
        user2.address,
        tokenId,
        sellValue * 2,
        "0x",
      ]) + ZERO_BYTES32.substr(2);
    console.log(
      `firstErc3525Call(user1.address, user2.address, tokenId, sellValue * 2): ${firstErc3525Call}(${
        user1.address
      }, ${user2.address}, ${tokenId}, ${sellValue * 2})`
    );

    const firstData = atomicizerInterface.encodeFunctionData("atomicize", [
      [erc3525C.address],
      [0],
      [(firstErc3525Call.length - 2) / 2],
      firstErc3525Call,
    ]);
    console.log(
      `firstData(address[],uint256[],uint256,bytes): ${firstData}(${
        erc3525C.address
      }, 0, ${(firstErc3525Call.length - 2) / 2}, ${firstErc3525Call})`
    );

    const erc20Interface = new ethers.utils.Interface(TestErc20Bin.abi);
    const secondERC20Call = erc20Interface.encodeFunctionData("transferFrom", [
      user2.address,
      user1.address,
      2 * sellValue * price,
    ]);
    console.log(
      `secondERC20Call(user2.address, user1.address, 2 * sellValue * price): ${secondERC20Call}(${
        user2.address
      }, ${user1.address}, ${2 * sellValue * price})`
    );
    const secondData = atomicizerInterface.encodeFunctionData("atomicize", [
      [erc20C.address],
      [0],
      [(secondERC20Call.length - 2) / 2],
      secondERC20Call,
    ]);
    console.log(
      `secondData(address[],uint256[],uint256,bytes): ${secondData}(${
        erc20C.address
      }, 0, ${(secondERC20Call.length - 2) / 2}, ${secondERC20Call})`
    );

    const firstCall = {
      target: atomicizerC.address,
      howToCall: 1,
      data: firstData,
    };
    console.log(
      `firstCall(target,howToCall,data): ${firstCall}(${atomicizerC.address}, 1, ${firstData})`
    );

    const secondCall = {
      target: atomicizerC.address,
      howToCall: 1,
      data: secondData,
    };
    console.log(
      `secondCall(target,howToCall,data): ${secondCall}(${atomicizerC.address}, 1, ${secondData})`
    );

    const twoSig: any = NULL_SIG;

    const oneSigEncoded =
      ethers.utils.defaultAbiCoder.encode(
        ["uint8", "bytes32", "bytes32"],
        [listOrderSignedData.v, listOrderSignedData.r, listOrderSignedData.s]
      ) + (listOrderSignedData.suffix || "");
    console.log("oneSigEncoded", oneSigEncoded);
    const twoSigEncoded =
      ethers.utils.defaultAbiCoder.encode(
        ["uint8", "bytes32", "bytes32"],
        [twoSig.v, twoSig.r, twoSig.s]
      ) + (twoSig.suffix || "");
    console.log("twoSigEncoded", twoSigEncoded);
    const signatures = ethers.utils.defaultAbiCoder.encode(
      ["bytes", "bytes"],
      [oneSigEncoded, twoSigEncoded]
    );
    console.log("signatures", signatures);

    const erc3525BeforeBalance = await erc3525C.unitsInToken(tokenId);
    console.log("erc3525BeforeBalance", erc3525BeforeBalance.toNumber());
    const erc20BeforeBalance = await erc20C.balanceOf(user2.address);
    console.log("erc20BeforeBalance", erc20BeforeBalance.toNumber());

    const tx = await (
      await exchangeC.connect(user2)
    ).atomicMatch_(
      [
        one.registry,
        one.maker,
        one.staticTarget,
        one.maximumFill,
        one.listingTime,
        one.expirationTime,
        one.salt,
        firstCall.target,
        two.registry,
        two.maker,
        two.staticTarget,
        two.maximumFill,
        two.listingTime,
        two.expirationTime,
        two.salt,
        secondCall.target,
      ],
      [one.staticSelector, two.staticSelector],
      one.staticExtradata,
      firstCall.data,
      two.staticExtradata,
      secondCall.data,
      [firstCall.howToCall, secondCall.howToCall],
      ZERO_BYTES32,
      signatures
    );
    console.log("tx", tx);

    await tx.wait();

    const erc3525AfterBalance = await erc3525C.unitsInToken(tokenId);
    console.log("erc3525AfterBalance", erc3525AfterBalance.toNumber());
    const erc20AfterBalance = await erc20C.balanceOf(user2.address);
    console.log("erc20AfterBalance", erc20AfterBalance.toNumber());
  });
});
