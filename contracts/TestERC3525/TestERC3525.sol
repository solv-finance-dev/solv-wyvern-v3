// SPDX-License-Identifier: MIT

pragma solidity 0.7.5;

import "./VNFTCore.sol";

contract TestERC3525 is VNFTCore {
    using SafeMath for uint256;
    using SafeMath for uint64;

    address public admin;
    address public pendingAdmin;

    bool internal _notEntered;
    uint8 public unitDecimals;
    uint32 public nextTokenId;

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    modifier nonReentrant() {
        require(_notEntered, "re-entered");
        _notEntered = false;
        _;
        _notEntered = true;
        // get a gas-refund post-Istanbul
    }

    constructor() VNFTCore("TestERC3525", "3525", "", "")  {
        admin = msg.sender;

        nextTokenId = 100000000;
        _notEntered = true;
    }

     function mint(uint256 slot_, uint256 tokenId_, uint256 units_) external {

        VNFTCore._mintUnits(msg.sender, tokenId_, slot_, units_);
    }

    function owner() external view virtual returns (address) {
        return admin;
    }

    function setContractURI(string memory uri_) external virtual onlyAdmin {
        VNFTCore._setContractURI(uri_);
    }

    function setTokenURI(uint256 tokenId_, string memory uri_)
        external
        virtual
        onlyAdmin
    {
        ERC721._setTokenURI(tokenId_, uri_);
    }

    function setBaseURI(string memory uri_) external virtual onlyAdmin {
        ERC721._setBaseURI(uri_);
    }

    function split(uint256 tokenId_, uint256[] calldata splitUnits_)
        external
        virtual
        override
        returns (uint256[] memory newTokenIds)
    {
        require(splitUnits_.length > 0, "empty splitUnits");
        newTokenIds = new uint256[](splitUnits_.length);
        for (uint256 i = 0; i < splitUnits_.length; i++) {
            newTokenIds[i] = _splitUnits(tokenId_, splitUnits_[i]);
        }

        return newTokenIds;
    }

    function _splitUnits(uint256 tokenId_, uint256 splitUnits_)
        internal
        virtual
        returns (uint256 newTokenId)
    {
        newTokenId = nextTokenId + tokenId_;

        VNFTCore._splitUnits(tokenId_, newTokenId, splitUnits_);

        return newTokenId;
    }

    function merge(uint256[] calldata tokenIds_, uint256 targetTokenId_)
        external
        virtual
        override
    {
        require(tokenIds_.length > 0, "empty tokenIds");
        for (uint256 i = 0; i < tokenIds_.length; i++) {
            _merge(tokenIds_[i], targetTokenId_);
        }
    }

    function _merge(uint256 tokenId_, uint256 targetTokenId_)
        internal
        virtual
        override
    {
        VNFTCore._merge(tokenId_, targetTokenId_);
    }

    /**
     * @notice Transfer part of units of a Voucher to target address.
     * @param from_ Address of the Voucher sender
     * @param to_ Address of the Voucher recipient
     * @param tokenId_ Id of the Voucher to transfer
     * @param transferUnits_ Amount of units to transfer
     */
    function transferFrom(
        address from_,
        address to_,
        uint256 tokenId_,
        uint256 transferUnits_
    ) public virtual override returns (uint256 newTokenId) {
        newTokenId = nextTokenId + tokenId_;
        _transferUnitsFrom(from_, to_, tokenId_, newTokenId, transferUnits_);
    }

    /**
     * @notice Transfer part of units of a Voucher to another Voucher.
     * @param from_ Address of the Voucher sender
     * @param to_ Address of the Voucher recipient
     * @param tokenId_ Id of the Voucher to transfer
     * @param targetTokenId_ Id of the Voucher to receive
     * @param transferUnits_ Amount of units to transfer
     */
    function transferFrom(
        address from_,
        address to_,
        uint256 tokenId_,
        uint256 targetTokenId_,
        uint256 transferUnits_
    ) public virtual override {
        require(_exists(targetTokenId_), "target token not exists");
        _transferUnitsFrom(
            from_,
            to_,
            tokenId_,
            targetTokenId_,
            transferUnits_
        );
    }

    function safeTransferFrom(
        address from_,
        address to_,
        uint256 tokenId_,
        uint256 targetTokenId_,
        uint256 transferUnits_,
        bytes memory data_
    ) external virtual override {
        transferFrom(from_, to_, tokenId_, targetTokenId_, transferUnits_);
        require(
            _checkOnVNFTReceived(
                from_,
                to_,
                targetTokenId_,
                transferUnits_,
                data_
            ),
            "to non VNFTReceiver"
        );
    }

    function safeTransferFrom(
        address from_,
        address to_,
        uint256 tokenId_,
        uint256 transferUnits_,
        bytes memory data_
    ) external virtual override returns (uint256 newTokenId) {
        newTokenId = transferFrom(from_, to_, tokenId_, transferUnits_);
        require(
            _checkOnVNFTReceived(from_, to_, newTokenId, transferUnits_, data_),
            "to non VNFTReceiver"
        );
        return newTokenId;
    }

    function _transferUnitsFrom(
        address from_,
        address to_,
        uint256 tokenId_,
        uint256 targetTokenId_,
        uint256 transferUnits_
    ) internal virtual override {
        VNFTCore._transferUnitsFrom(
            from_,
            to_,
            tokenId_,
            targetTokenId_,
            transferUnits_
        );
    }

    function _sub(uint64 a, uint64 b) internal pure returns (uint64) {
        require(b <= a, "sub-overflow");
        return a - b;
    }
}
