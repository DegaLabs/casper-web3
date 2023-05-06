const {
    utils,
    helpers,
    CasperContractClient,
} = require("casper-js-client-helper");

const { CLValueBuilder, RuntimeArgs, CLAccountHash, CLString, CLPublicKey, CLKey, CLByteArray, CLValueParsers, LIST_ID, BYTE_ARRAY_ID, MAP_ID, TUPLE1_ID, TUPLE2_ID, TUPLE3_ID, OPTION_ID, RESULT_ID } = require("casper-js-sdk");
const CasperSDK = require('casper-js-sdk')
const { setClient, contractSimpleGetter, createRecipientAddress } = helpers;
let blake = require("blakejs")
const axios = require('axios')

function getNetwork(networkName) {
    return networkName == 'casper' ? 'mainnet' : 'testnet'
}

function getAPIToGetABI(networkName) {
    return `https://event-store-api-clarity-${getNetwork(networkName)}.make.services/rpc/state_get_item`
}

async function getStateRootHash(networkName) {
    const url = `https://event-store-api-clarity-${getNetwork(networkName)}.make.services/rpc/info_get_status`
    const data = await axios.get(url)
    return data.data.result.last_added_block_info.state_root_hash
}

function serializeParam(t, v) {
    switch (t) {
        case CasperSDK.BOOL_ID:
            return CLValueBuilder.bool(v)
        case CasperSDK.KEY_ID:
            return CLValueBuilder.key(v)
        case CasperSDK.PUBLIC_KEY_ID:
            return CLValueBuilder.publicKey(v)
        case CasperSDK.STRING_ID:
            return CLValueBuilder.string(v)
        case CasperSDK.UREF_ID:
            return CLValueBuilder.uref(v, CasperSDK.AccessRights.None)
        case CasperSDK.UNIT_ID:
            return CLValueBuilder.unit()
        case CasperSDK.I32_ID:
            return CLValueBuilder.i32(v)
        case CasperSDK.I64_ID:
            return CLValueBuilder.i64(v)
        case CasperSDK.U8_ID:
            return CLValueBuilder.u8(v)
        case CasperSDK.U32_ID:
            return CLValueBuilder.u32(v)
        case CasperSDK.U64_ID:
            return CLValueBuilder.u64(v)
        case CasperSDK.U128_ID:
            return CLValueBuilder.u128(v)
        case CasperSDK.U256_ID:
            return CLValueBuilder.u256(v)
        case CasperSDK.U512_ID:
            return CLValueBuilder.u512(v)
        default:
            break;
    }

    if (LIST_ID in t) {
        const splits = t.replace(" ", "").replace("]", "").splits("[")
        const typeName = splits[1]
        return CLValueBuilder.list(v.map(e => serializeParam(typeName, e)))
    } else if (BYTE_ARRAY_ID in t) {
        return CLValueBuilder.byteArray(v)
    } else if (MAP_ID in t) {

    } else if (TUPLE1_ID in type) {

    } else if (TUPLE2_ID in type) {

    } else if (TUPLE3_ID in type) {

    } else if (OPTION_ID in type) {

    } else if (RESULT_ID in type) {

    }
}

const Contract = class {
    constructor(contractHash, nodeAddress, chainName, namedKeysList = [], entryPoints = []) {
        this.contractHash = contractHash.startsWith("hash-")
            ? contractHash.slice(5)
            : contractHash;
        this.nodeAddress = nodeAddress;
        this.chainName = chainName;
        this.contractClient = new CasperContractClient(nodeAddress, chainName);
        this.namedKeysList = namedKeysList
        this.entryPoints = entryPoints
    }

    async init() {
        const { contractPackageHash, namedKeys } = await setClient(
            this.nodeAddress,
            this.contractHash,
            this.namedKeysList
        );
        this.contractPackageHash = contractPackageHash;
        this.contractClient.chainName = this.chainName
        this.contractClient.contractHash = this.contractHash
        this.contractClient.contractPackageHash = this.contractPackageHash
        this.contractClient.nodeAddress = this.nodeAddress
        this.namedKeys = namedKeys;

        this.getter = {}
        this.contractCalls = {}

        await this.createGetterFunctions()
        await this.createMethods()
    }

    async createGetterFunctions() {
        const nodeAddress = this.nodeAddress
        const contractHash = this.contractHash
        const chainName = this.chainName
        const namedKeys = this.namedKeys
        for (const _nk of this.namedKeysList) {
            const nk = utils.camelCased(_nk)
            this.getter[`${nk}`] = async function (itemKey) {
                try {
                    const uref = namedKeys[nk]
                    const stateRootHash = await getStateRootHash(chainName)
                    let stateOfNK = await axios.get(`https://event-store-api-clarity-${getNetwork(chainName)}.make.services/rpc/state_get_item?state_root_hash=${stateRootHash}&key=${uref}`)
                    stateOfNK = stateOfNK.data.result.stored_value.CLValue

                    if (stateOfNK) {
                        if (stateOfNK.cl_type == 'Unit') {
                            const result = await utils.contractDictionaryGetter(
                                nodeAddress,
                                itemKey.toString(),
                                uref
                            );
                            return result.data
                        } else {
                            let ret = await contractSimpleGetter(nodeAddress, contractHash, [
                                _nk
                            ]);
                            return ret
                        }
                    }
                    return null
                } catch (e) {
                    throw e;
                }
            }
        }
    }

    async createMethods() {
        const contractHash = this.contractHash
        const chainName = this.chainName
        const entryPoints = this.entryPoints
        for (const ep of entryPoints) {
            const epName = utils.camelCased(ep.name)
            const contractClient = this.contractClient
            this.contractCalls[`${epName}`] = {
                makeUnsignedDeploy: async function ({ publicKey, args = {}, paymentAmount, ttl}) {
                    const argNames = Object.keys(args)
                    const argMap = {}
                    for (const argName of argNames) {
                        const argValue = args[argName]
                        const argInEp = ep.args.find(e => utils.camelCased(e.name) == argName)
                        if (!argInEp) {
                            throw new Error('Invalid argument ' + argName)
                        }

                        argMap[`${argInEp.name}`] = serializeParam(argInEp.cl_type, argValue)
                        return CasperSDK.DeployUtil.makeDeploy()
                    }

                    const contractHashAsByteArray = utils.contractHashToByteArray(contractHash)

                    return CasperSDK.DeployUtil.makeDeploy(
                        new CasperSDK.DeployUtil.DeployParams(
                            publicKey,
                            chainName,
                            1,
                            ttl,
                            [],
                        ),
                        CasperSDK.DeployUtil.ExecutableDeployItem.newStoredContractByHash(
                            contractHashAsByteArray,
                            ep.name,
                            RuntimeArgs.fromMap(argMap),
                        ),
                        CasperSDK.DeployUtil.standardPayment(paymentAmount),
                    )
                },
                makeDeployAndSend: async function ({ keys, args = {}, paymentAmount, ttl }) {
                    const argNames = Object.keys(args)
                    const argMap = {}
                    for (const argName of argNames) {
                        const argValue = args[argName]
                        const argInEp = ep.args.find(e => utils.camelCased(e.name) == argName)
                        if (!argInEp) {
                            throw new Error('Invalid argument ' + argName)
                        }

                        argMap[`${argInEp.name}`] = serializeParam(argInEp.cl_type, argValue)
                    }

                    return await contractClient.contractCall({
                        entryPoint: ep.name,
                        keys: keys,
                        paymentAmount: paymentAmount,
                        runtimeArgs: RuntimeArgs.fromMap(argMap),
                        cb: () => { },
                        ttl
                    });
                }
            }

        }
    }

    static async createInstance(contractHash, nodeAddress, chainName, abi) {
        const namedKeysList = (abi.named_keys ? abi.named_keys : []).map(e => e.name)
        const instance = new Contract(contractHash, nodeAddress, chainName, namedKeysList, abi.entry_points ? abi.entry_points : []);
        await instance.init();
        return instance;
    }

    static async createInstanceWithRemoteABI(contractHash, nodeAddress, chainName) {
        const apiToGetABI = getAPIToGetABI(chainName)
        const stateRootHash = await getStateRootHash(chainName)
        const data = await axios.get(`${apiToGetABI}?state_root_hash=${stateRootHash}&key=hash-${contractHash}`)
        const ABI = data.data.result.stored_value.Contract
        return await Contract.createInstance(contractHash, nodeAddress, chainName, ABI)
    }
}

module.exports = {
    Contract,
    serializeParam
}