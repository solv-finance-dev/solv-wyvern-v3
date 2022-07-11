/*

  << Static Caller >>

*/

pragma solidity 0.7.5;
import "hardhat/console.sol";

/**
 * @title StaticCaller
 * @author Wyvern Protocol Developers
 */
contract StaticCaller {
    function staticCall(address target, bytes memory data)
        internal
        view
        returns (bool result)
    {
        assembly {
            result := staticcall(
                gas(),
                target,
                add(data, 0x20),
                mload(data),
                mload(0x40),
                0
            )
        }
        return result;
    }

    function staticCallUint(address target, bytes memory data)
        internal
        view
        returns (uint256 ret)
    {
        console.log("target", target);
        console.logBytes(data);
        bool result;
        assembly {
            let size := 0x20
            let free := mload(0x40)
            result := staticcall(
                gas(),
                target,
                add(data, 0x20),
                mload(data),
                free,
                size
            )
            ret := mload(free)
        }
        require(result, "Static call failed");
        return ret;
    }
}
