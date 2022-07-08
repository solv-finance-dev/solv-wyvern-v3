/*

StaticERC3525 - static calls for ERC3525 trades

*/

pragma solidity 0.7.5;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

import "../lib/ArrayUtils.sol";
import "../registry/AuthenticatedProxy.sol";

contract StaticERC3525 {
    function transferERC3525Exact(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall howToCall,
        uint256[6] memory,
        bytes memory data
    ) public pure {
        // Decode extradata (to, tokenId, value)
        (address token, uint256 tokenId, uint256 amount) = abi.decode(
            extra,
            (address, uint256, uint256)
        );

        // Call target = token to give
        require(addresses[2] == token);
        // Call type = call
        require(howToCall == AuthenticatedProxy.HowToCall.Call);
        // Assert calldata
        require(
            ArrayUtils.arrayEq(
                data,
                abi.encodeWithSignature(
                    "safeTransferFrom(address,address,uint256,uint256,bytes)",
                    addresses[1],
                    addresses[4],
                    tokenId,
                    amount,
                    ""
                )
            )
        );
    }

    function swapOneForOneERC3525(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[6] memory uints,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        // Zero-value
        require(uints[0] == 0);

        // Decode extradata
        (
            address[2] memory tokenGiveGet,
            uint256[2] memory voucherGiveGet,
            uint256[2] memory transferValues
        ) = abi.decode(extra, (address[2], uint256[2], uint256[2]));

        // Call target = token to give
        require(
            addresses[2] == tokenGiveGet[0],
            "ERC3525: call target must equal address of token to give"
        );
        // Assert more than zero
        require(
            transferValues[0] > 0,
            "ERC3525: give transfer value must be larger than zero"
        );
        // Call type = call
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            "ERC3525: call must be a direct call"
        );
        // Assert calldata
        require(
            ArrayUtils.arrayEq(
                data,
                abi.encodeWithSignature(
                    "safeTransferFrom(address,address,uint256,uint256,bytes)",
                    addresses[1],
                    addresses[4],
                    voucherGiveGet[0],
                    transferValues[0],
                    ""
                )
            )
        );

        // Countercall target = token to get
        require(
            addresses[5] == tokenGiveGet[1],
            "ERC3525: countercall target must equal address of token to get"
        );
        // Assert more than zero
        require(
            transferValues[1] > 0,
            "ERC3525: take amount must be larger than zero"
        );
        // Countercall type = call
        require(
            howToCalls[1] == AuthenticatedProxy.HowToCall.Call,
            "ERC3525: countercall must be a direct call"
        );
        // Assert countercalldata
        require(
            ArrayUtils.arrayEq(
                counterdata,
                abi.encodeWithSignature(
                    "safeTransferFrom(address,address,uint256,uint256,bytes)",
                    addresses[4],
                    addresses[1],
                    voucherGiveGet[1],
                    transferValues[1],
                    ""
                )
            )
        );

        // Mark filled
        return 1;
    }

    function swapOneForOneERC3525Decoding(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[6] memory uints,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        // Calculate function signature
        bytes memory sig = ArrayUtils.arrayTake(
            abi.encodeWithSignature(
                "safeTransferFrom(address,address,uint256,uint256,bytes)"
            ),
            4
        );

        // Zero-value
        require(uints[0] == 0);

        // Decode extradata
        (
            address[2] memory tokenGiveGet,
            uint256[2] memory voucherGiveGet,
            uint256[2] memory transferValues
        ) = abi.decode(extra, (address[2], uint256[2], uint256[2]));

        // Call target = token to give
        require(
            addresses[2] == tokenGiveGet[0],
            "ERC3525: call target must equal address of token to give"
        );
        // Call type = call
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            "ERC3525: call must be a direct call"
        );
        // Assert signature
        require(ArrayUtils.arrayEq(sig, ArrayUtils.arrayTake(data, 4)));
        // Decode and assert calldata
        require(
            ArrayUtils.arrayEq(
                data,
                abi.encodeWithSignature(
                    "safeTransferFrom(address,address,uint256,uint256,bytes)",
                    addresses[1],
                    addresses[4],
                    voucherGiveGet[0],
                    transferValues[0],
                    ""
                )
            )
        );
        // Decode and assert countercalldata
        require(
            ArrayUtils.arrayEq(
                counterdata,
                abi.encodeWithSignature(
                    "safeTransferFrom(address,address,uint256,uint256,bytes)",
                    addresses[4],
                    addresses[1],
                    voucherGiveGet[1],
                    transferValues[1],
                    ""
                )
            )
        );

        // Mark filled
        return 1;
    }
}
