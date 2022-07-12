import { ethers, network } from "hardhat";
import {
  TestERC20,
  TestERC3525,
  WyvernExchange,
  WyvernRegistry,
  StaticMarket,
} from "../typechain";
import { BigNumber, Contract } from "ethers";
import WyvernStaticBin from "../artifacts/contracts/StaticMarket.sol/StaticMarket.json";
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

  const loadCoreContracts = async () => {
    const registryFactory = await ethers.getContractFactory("WyvernRegistry");
    const r = (await registryFactory.attach(
      "0x4F9057833f4ba22aCc657FABCc93Ad80296f4E29"
    )) as WyvernRegistry;
    console.log("registry attached, address", r.address);

    const staticFactory = await ethers.getContractFactory("StaticMarket");
    const s = (await staticFactory.attach(
      "0xac00E59f210741f643c496c58467Fadb390D25D5"
    )) as StaticMarket;
    console.log("static attached, address", s.address);

    const exchangeFactory = await ethers.getContractFactory("WyvernExchange");
    const e = (await exchangeFactory.attach(
      "0xf71717B85fa83A87eA13Da217bF3f49Cb888749e"
    )) as WyvernExchange;
    console.log("exchange attached, address", e.address);

    return { r, s, e };
  };

  const deployCoreContracts = async () => {
    const registryFactory = await ethers.getContractFactory("WyvernRegistry");
    const r = (await registryFactory.deploy()) as WyvernRegistry;
    await r.deployed();
    console.log("registry deployed, address", r.address);

    const staticFactory = await ethers.getContractFactory("StaticMarket");
    const s = (await staticFactory.deploy()) as StaticMarket;
    await s.deployed();
    console.log("static deployed, address", s.address);

    const exchangeFactory = await ethers.getContractFactory("WyvernExchange");
    const e = (await exchangeFactory.deploy(
      network.config.chainId,
      [r.address],
      "0x"
    )) as WyvernExchange;
    await e.deployed();
    console.log("exchange deployed, address", e.address);

    await r.grantInitialAuthentication(e.address);
    console.log("grantInitialAuthentication to exchange OK", e.address);

    return { r, s, e };
  };

  const deployContracts = async (contract: string): Promise<Contract> => {
    const factory = await ethers.getContractFactory(contract);
    const c = (await factory.deploy()) as Contract;
    await c.deployed();
    return c;
  };

  it("StaticMarket: matches erc3525 <> erc20 order, allows any partial fill", async function () {
    console.log("network chainId", network.config.chainId);
    const [user1, user2] = await ethers.getSigners();
    console.log("user1 address", user1.address);
    console.log("user2 address", user2.address);
    const erc20Decimals = BigNumber.from("1000000");
    const erc3525Decimals = BigNumber.from("1000000000000000000");
    const price = BigNumber.from("13").mul(erc20Decimals);
    const slot = 999;
    const tokenId = 4;
    const maximumSellValue = BigNumber.from("20").mul(erc3525Decimals);
    const buyValue = maximumSellValue.div(2);
    let registryC, staticC, exchangeC;
    if (network.config.chainId === 50 || network.config.chainId === 4) {
      const { r, s, e } = await deployCoreContracts();
      registryC = r;
      staticC = s;
      exchangeC = e;
    } else {
      const { r, s, e } = await loadCoreContracts();
      registryC = r;
      staticC = s;
      exchangeC = e;
    }
    const erc3525C = (await deployContracts("TestERC3525")) as TestERC3525;
    const erc20C = (await deployContracts("TestERC20")) as TestERC20;
    console.log("deploy contracts ERC20 && ERC3525 success");

    let proxy1 = await registryC.proxies(user1.address);
    if (proxy1 === ZERO_ADDRESS) {
      const tx = await (await registryC.connect(user1)).registerProxy();
      await tx.wait();
      console.log("register user1 proxy success");
      proxy1 = await registryC.proxies(user1.address);
    }
    console.log("proxy1 address", proxy1);
    let proxy2 = await registryC.proxies(user2.address);
    if (proxy2 === ZERO_ADDRESS) {
      const tx = await (await registryC.connect(user2)).registerProxy();
      await tx.wait();
      console.log("register user2 proxy success");
      proxy2 = await registryC.proxies(user2.address);
    }
    console.log("proxy2 address", proxy2);

    const erc20MaxValue = maximumSellValue.mul(price).div(erc3525Decimals);

    await (await erc3525C.connect(user1)).mint(slot, tokenId, maximumSellValue);
    console.log(
      "mint erc3525 success",
      user1.address,
      tokenId,
      maximumSellValue.div(erc3525Decimals).toString()
    );

    await (await erc20C.connect(user2)).mint(user2.address, erc20MaxValue);
    console.log(
      "mint erc20 success",
      user2.address,
      erc20MaxValue.div(erc20Decimals).toString()
    );

    await (await erc3525C.connect(user1)).setApprovalForAll(proxy1, true);
    console.log("approve erc3525 success", user1.address, proxy1);
    await (await erc20C.connect(user2)).approve(proxy2, erc20MaxValue);
    console.log(
      "approve erc20 success",
      user2.address,
      proxy2,
      erc20MaxValue.div(erc20Decimals).toString()
    );

    // list
    const staticInterface = new ethers.utils.Interface(WyvernStaticBin.abi);
    const selectorOne = staticInterface.getSighash("anyERC3525ForERC20");
    // console.log("selectorOne: anyERC3525ForERC20", selectorOne);
    const selectorTwo = staticInterface.getSighash("anyERC20ForERC3525");
    // console.log("selectorOne: anyERC20ForERC3525", selectorTwo);

    const sellingNumerator = erc3525Decimals;
    const buyingDenominator = erc3525Decimals;
    const paramsOne = ethers.utils.defaultAbiCoder.encode(
      ["address[2]", "uint256[3]"],
      [
        [erc3525C.address, erc20C.address],
        [tokenId, sellingNumerator, price],
      ]
    );
    console.log(
      `anyERC3525ForERC20(erc3525.address, erc20.address, tokenId, sellingNumerator, price): 
      (${erc3525C.address}, ${erc20C.address}, ${tokenId}, ${sellingNumerator}, ${price})`
    );

    const paramsTow = ethers.utils.defaultAbiCoder.encode(
      ["address[2]", "uint256[3]"],
      [
        [erc20C.address, erc3525C.address],
        [tokenId, price, buyingDenominator],
      ]
    );
    console.log(
      `anyERC20ForERC3525(erc20.address, erc3525.address, tokenId, buyValue, price): 
      (${erc20C.address}, ${erc3525C.address}, ${tokenId}, ${buyingDenominator}, ${price})`
    );

    const one = {
      registry: registryC.address,
      maker: user1.address,
      staticTarget: staticC.address,
      staticSelector: selectorOne,
      staticExtradata: paramsOne,
      maximumFill: "" + maximumSellValue,
      listingTime: "0",
      expirationTime: "10000000000",
      salt: "3358",
    };
    // console.log("one order", one);
    const typedDataOne = {
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
    // console.log("typedDataOne", typedDataOne);

    const sigOneRaw = await user1._signTypedData(
      typedDataOne.domain,
      { Order: eip712Order.fields },
      one
    );
    const sigOne: any = parseSig(sigOneRaw);
    // console.log("sigOne", sigOne);

    // trade
    const erc20BuyValue = buyValue.mul(price).div(erc3525Decimals);
    for (let i = 0; i < 1; i++) {
      const two = {
        registry: registryC.address,
        maker: user2.address,
        staticTarget: staticC.address,
        staticSelector: selectorTwo,
        staticExtradata: paramsTow,
        maximumFill: "" + erc20BuyValue,
        listingTime: "0",
        expirationTime: "10000000000",
        salt: "20",
      };
      // console.log("two order", two);
      const typedDataTwo = {
        name: eip712Order.name,
        fields: eip712Order.fields,
        domain: {
          name: "Wyvern Exchange",
          version: "3.1",
          chainId: network.config.chainId,
          verifyingContract: exchangeC.address,
        },
        data: two,
      };
      // console.log("typedDataTwo", typedDataTwo);
      const sigOneTwo = await user2._signTypedData(
        typedDataTwo.domain,
        { Order: eip712Order.fields },
        two
      );
      const sigTwo: any = parseSig(sigOneTwo);
      // console.log("sigTwo", sigTwo);
      const erc3525Interface = new ethers.utils.Interface(TestErc3525Bin.abi);
      const transferFromFragment = erc3525Interface.getFunction(
        "safeTransferFrom(address,address,uint256,uint256,bytes)"
      );
      /*
      console.log(
        "erc3525 transferFromFragment: safeTransferFrom",
        transferFromFragment
      );
      */

      const firstData =
        erc3525Interface.encodeFunctionData(transferFromFragment, [
          user1.address,
          user2.address,
          tokenId,
          buyValue,
          "0x",
        ]) + ZERO_BYTES32.substr(2);
      console.log(
        `firstData(user1.address, user2.address, tokenId, buyValue): (${user1.address}, ${user2.address}, ${tokenId}, ${buyValue})`
      );

      const erc20Interface = new ethers.utils.Interface(TestErc20Bin.abi);
      const secondData = erc20Interface.encodeFunctionData("transferFrom", [
        user2.address,
        user1.address,
        erc20BuyValue,
      ]);
      console.log(
        `secondData(user2.address, user1.address, erc20BuyValue): (${user2.address}, ${user1.address}, ${erc20BuyValue})`
      );

      const firstCall = {
        target: erc3525C.address,
        howToCall: 0,
        data: firstData,
      };
      const secondCall = {
        target: erc20C.address,
        howToCall: 0,
        data: secondData,
      };

      const oneSigEncoded =
        ethers.utils.defaultAbiCoder.encode(
          ["uint8", "bytes32", "bytes32"],
          [sigOne.v, sigOne.r, sigOne.s]
        ) + (sigOne.suffix || "");
      // console.log("oneSigEncoded", oneSigEncoded);
      const twoSigEncoded =
        ethers.utils.defaultAbiCoder.encode(
          ["uint8", "bytes32", "bytes32"],
          [sigTwo.v, sigTwo.r, sigTwo.s]
        ) + (sigTwo.suffix || "");
      // console.log("twoSigEncoded", twoSigEncoded);
      const signatures = ethers.utils.defaultAbiCoder.encode(
        ["bytes", "bytes"],
        [oneSigEncoded, twoSigEncoded]
      );
      // console.log("signatures", signatures);

      const erc3525BeforeBalance = await erc3525C.unitsInToken(tokenId);
      console.log(
        "erc3525BeforeBalance",
        erc3525BeforeBalance.div(erc3525Decimals).toString()
      );
      const erc20BeforeBalance = await erc20C.balanceOf(user2.address);
      console.log(
        "erc20BeforeBalance",
        erc20BeforeBalance.div(erc20Decimals).toString()
      );

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
      // console.log("tx", tx);

      await tx.wait();

      const erc3525AfterBalance = await erc3525C.unitsInToken(tokenId);
      console.log(
        "erc3525AfterBalance",
        erc3525AfterBalance.div(erc3525Decimals).toString()
      );
      const erc20AfterBalance = await erc20C.balanceOf(user2.address);
      console.log(
        "erc20AfterBalance",
        erc20AfterBalance.div(erc20Decimals).toString()
      );
    }
  });
});
