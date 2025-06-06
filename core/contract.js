const fs = require('fs');

const { CLValueBuilder, RuntimeArgs, CasperClient, matchTypeToCLType } = require("casper-js-sdk");
const { Some } = require('ts-results')
const CasperSDK = require('casper-js-sdk')
const DEFAULT_TTL = 1800000

function createRpcClient(rpc) {
    const rpcHandler = new CasperSDK.HttpHandler(rpc);
    return new CasperSDK.RpcClient(rpcHandler);
}



const contractHashToByteArray = (contractHash) => Uint8Array.from(Buffer.from(contractHash, "hex"));
const camelCased = (myString) => myString.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
/**
 * The function takes a type and value as input and returns a serialized CLValueBuilder object based on
 * the type.
 * @param t - The type of the parameter being serialized.
 * @param v - The value to be serialized into a CLValue.
 * @returns a serialized CLValue (CasperLabs Value) based on the input type and value. The CLValue is
 * built using the CLValueBuilder class from the CasperSDK library. The specific CLValue type is
 * determined by the input type (t) using a switch statement, and the corresponding CLValueBuilder
 * method is called with the input value (v) as a parameter. If
 */
function serializeParam(t, v) {
    switch (t) {
        case CasperSDK.CLTypeBool.getTypeID():
            return CasperSDK.CLValue.newCLValueBool(v)
        case CasperSDK.CLTypeKey.getTypeID():
            return CasperSDK.CLValue.newCLKey(v)
        case CasperSDK.CLTypePublicKey.getTypeID():
            return CasperSDK.CLValue.newCLPublicKey(CasperSDK.PublicKey.fromHex(v))
        case CasperSDK.CLTypeString.getTypeID():
            return CasperSDK.CLValue.newCLString(v)
        case CasperSDK.CLTypeUref.getTypeID():
            return CasperSDK.CLValue.newCLUref(v)
        case CasperSDK.CLTypeUnit.getTypeID():
            return CasperSDK.CLValue.newCLUnit()
        case CasperSDK.CLTypeInt32.getTypeID():
            return CasperSDK.CLValue.newCLInt32(v)
        case CasperSDK.CLTypeInt64.getTypeID():
            return CasperSDK.CLValue.newCLInt64(v)
        case CasperSDK.CLTypeUInt8.getTypeID():
            return CasperSDK.CLValue.newCLUint8(v)
        case CasperSDK.CLTypeUInt32.getTypeID():
            return CasperSDK.CLValue.newCLUInt32(v)
        case CasperSDK.CLTypeUInt64.getTypeID():
            return CasperSDK.CLValue.newCLUint64(v)
        case CasperSDK.CLTypeUInt128.getTypeID():
            return CasperSDK.CLValue.newCLUInt128(v)
        case CasperSDK.CLTypeUInt256.getTypeID():
            return CasperSDK.CLValue.newCLUInt256(v)
        case CasperSDK.CLTypeUInt512.getTypeID():
            return CasperSDK.CLValue.newCLUInt512(v)
        default:
            break;
    }

    const type = t
    if (typeof type === typeof {}) {
        if (CasperSDK.CLTypeList in type) {
            const inner = matchTypeToCLType(type[CasperSDK.LIST_TYPE]);
            return CLValueBuilder.list(v.map(e => serializeParam(inner.toString(), e)))
        }
        if (CasperSDK.BYTE_ARRAY_TYPE in type) {
            // const size = type[BYTE_ARRAY_TYPE];
            return CLValueBuilder.byteArray(v)
        }
        if (CasperSDK.MAP_TYPE in type) {
            const keyType = matchTypeToCLType(type[CasperSDK.MAP_TYPE].key);
            const valType = matchTypeToCLType(type[CasperSDK.MAP_TYPE].value);
            const mapItems = v.map(e => [serializeParam(keyType, e[0]), serializeParam(valType, e[1])])
            return CLValueBuilder.map(mapItems)
        }
        if (CasperSDK.TUPLE1_TYPE in type) {
            const vals = type[TUPLE1_TYPE].map((t) => matchTypeToCLType(t));
            const ret = []
            for (var i = 0; i < vals.length; i++) {
                ret.push(serializeParam(vals[i].toString(), v[i]))
            }
            return CLValueBuilder.tuple1(ret)
        }
        if (CasperSDK.TUPLE2_TYPE in type) {
            const vals = type[TUPLE2_TYPE].map((t) => matchTypeToCLType(t));
            const ret = []
            for (var i = 0; i < vals.length; i++) {
                ret.push(serializeParam(vals[i].toString(), v[i]))
            }
            return CLValueBuilder.tuple2(ret)
        }
        if (CasperSDK.TUPLE3_TYPE in type) {
            const vals = type[TUPLE3_TYPE].map((t) => matchTypeToCLType(t));
            const ret = []
            for (var i = 0; i < vals.length; i++) {
                ret.push(serializeParam(vals[i].toString(), v[i]))
            }
            return CLValueBuilder.tuple3(ret)
        }
        if (CasperSDK.OPTION_TYPE in type) {
            return CLValueBuilder.option(Some())
        }
        if (CasperSDK.RESULT_TYPE in type) {
            return
        }
        throw new Error(`The complex type ${type} is not supported`);
    }
}


/**
 * This function deserializes a parameter based on its type using various parsers in the CasperSDK
 * library.
 * @param t - The parameter `t` is a type identifier used to determine how to deserialize the value
 * `v`. It is used in a switch statement to determine which deserialization method to use.
 * @param v - The parameter `v` is a byte array that represents a serialized value of a specific type
 * `t`. The function `deserializeParam` takes in the type `t` and the byte array `v` and returns the
 * deserialized value of the specified type along with any remaining bytes in the byte array
 * @returns an object with two properties: "remainder" and "value". The "remainder" property contains
 * the remaining bytes after parsing the input value, and the "value" property contains the parsed
 * value. The specific values and types of these properties depend on the input type (specified by the
 * "t" parameter) and the input value (specified by the "v" parameter).
 */
function deserializeParam(clType, v) {
    let ret = CasperSDK.CLValueParser.fromBytesByType(v, clType)
    return { remainder: ret.bytes, value: ret.result }
}

/* The above code defines a JavaScript class called `Contract` that provides methods for interacting
with a smart contract on the Casper blockchain. The class constructor takes in parameters such as
the contract hash, node address, chain name, named keys list, and entry points. The class has
methods for initializing the contract, creating getter functions, creating methods for making
unsigned deploys and sending deploys, parsing events from a Casper deploy, creating an instance of a
smart contract, retrieving information about a contract package, retrieving the active contract hash
for a given contract package hash and chain name, and installing a smart contract */
const Contract = class {
    /**
     * This is a constructor function that initializes properties for a Casper contract client object.
     * @param contractHash - The hash of the smart contract on the Casper blockchain.
     * @param nodeAddress - The nodeAddress parameter is the address of the node that the
     * CasperContractClient will use to interact with the Casper blockchain. It is typically in the
     * format of "http://<ip_address>:<port>".
     * @param chainName - The name of the Casper blockchain network that the contract is deployed on.
     * @param [namedKeysList] - `namedKeysList` is an optional parameter that is an array of named keys
     * associated with the contract. Named keys are used to store and retrieve data from the contract's
     * global state. They can be used to store information such as account balances, contract
     * configuration settings, and more. If provided, the
     * @param [entryPoints] - `entryPoints` is an optional parameter that represents the list of entry
     * points of a smart contract. An entry point is a function that can be called from outside the
     * contract to interact with it. It is defined in the smart contract code and can have parameters
     * and return values. By providing a list of
     */
    constructor(contractPackageHash, contractHash, nodeAddress, chainName, namedKeys = [], entryPoints = []) {
        this.contractHash = contractHash.startsWith("hash-")
            ? contractHash.slice(5)
            : contractHash;
        this.contractPackageHash = contractPackageHash.startsWith("hash-") ? contractPackageHash.slice(5) : contractPackageHash;
        this.nodeAddress = nodeAddress;
        this.chainName = chainName;
        this.namedKeys = namedKeys
        this.namedKeysList = namedKeys.map(e => e.name)
        this.entryPoints = entryPoints.map(e => e.entryPoint)
    }

    /**
     * This function initializes a JavaScript object with various properties and methods for
     * interacting with a smart contract on a blockchain network.
     */
    async init() {
        this.getter = {}
        this.contractCalls = {}

        await this.createGetterFunctions()
        await this.createMethods()
    }

    /**
     * This function creates getter functions for a smart contract in JavaScript.
     * @returns This code is defining a function `createGetterFunctions()` that does not return
     * anything. It creates getter functions for named keys in a contract and assigns them to the
     * `getter` object.
     */
    async createGetterFunctions() {
        const nodeAddress = this.nodeAddress
        const namedKeys = this.namedKeys
        for (const _nk of this.namedKeysList) {
            const nk = camelCased(_nk)
            this.getter[`${nk}`] = async function (itemKey) {
                try {
                    const rpcClient = createRpcClient(nodeAddress)
                    const namedKey = namedKeys.find(e => e.name == _nk)
                    const uref = namedKey.key.uRef.toString()

                    if (!itemKey) {
                        let stateOfNK = await rpcClient.getStateItem(null, `uref-${uref}`, [])
                        return stateOfNK.storedValue.clValue
                    } else {
                        // read dictionary
                        const val = await rpcClient.getDictionaryItemByIdentifier(null, new CasperSDK.ParamDictionaryIdentifier(
                            null,
                            null,
                            new CasperSDK.ParamDictionaryIdentifierURef(itemKey, `uref-${uref}`)
                        ))
                        return val.storedValue.clValue
                    }
                    return null
                } catch (e) {
                    throw e;
                }
            }
        }
    }

    /**
     * This function creates and returns methods for making unsigned deploys and sending deploys for a
     * given smart contract and its entry points.
     * @returns The `createMethods()` function does not have a return statement, so it does not return
     * anything.
     */
    async createMethods() {
        const contractHash = this.contractHash
        const chainName = this.chainName
        const nodeAddress = this.nodeAddress
        const entryPoints = this.entryPoints
        for (const ep of entryPoints) {
            const epName = camelCased(ep.name)
            this.contractCalls[`${epName}`] = {
                makeUnsignedDeploy: async function ({ publicKey, args = {}, paymentAmount, ttl = DEFAULT_TTL }) {
                    const argNames = Object.keys(args)
                    const argMap = {}
                    for (const argName of argNames) {
                        const argValue = args[argName]
                        const argInEp = ep.args.find(e => camelCased(e.name) == argName)
                        if (!argInEp) {
                            throw new Error('Invalid argument ' + argName)
                        }
                        argMap[`${argInEp.name}`] = serializeParam(argInEp.clType.typeID, argValue)
                    }

                    const deployHeader = CasperSDK.DeployHeader.default()
                    deployHeader.account = publicKey
                    deployHeader.chainName = 'casper'
                    deployHeader.ttl = new CasperSDK.Duration(ttl)
                    const executableItem = new CasperSDK.ExecutableDeployItem()
                    executableItem.storedContractByHash = new CasperSDK.StoredContractByHash(
                        new CasperSDK.ContractHash(CasperSDK.Hash.fromHex(contractHash), ''),
                        ep.name,
                        CasperSDK.Args.fromMap(argMap),
                    )

                    return CasperSDK.Deploy.makeDeploy(
                        deployHeader,
                        CasperSDK.ExecutableDeployItem.standardPayment(paymentAmount),
                        executableItem,
                    )
                },
                makeDeployAndSend: async function ({ keys, args = {}, paymentAmount, ttl = DEFAULT_TTL }) {
                    const argNames = Object.keys(args)
                    const argMap = {}
                    for (const argName of argNames) {
                        const argValue = args[argName]
                        const argInEp = ep.args.find(e => camelCased(e.name) == argName)
                        if (!argInEp) {
                            throw new Error('Invalid argument ' + argName)
                        }

                        argMap[`${argInEp.name}`] = serializeParam(argInEp.clType.typeID, argValue)
                    }

                    const client = new CasperClient(nodeAddress)
                    const contractHashAsByteArray = contractHashToByteArray(contractHash)
                    const dependenciesBytes = [].map((d) =>
                        Uint8Array.from(Buffer.from(d, 'hex')),
                    )

                    console.log('argMap', argMap)

                    let deploy = DeployUtil.makeDeploy(
                        new DeployUtil.DeployParams(
                            keys.publicKey,
                            chainName,
                            1,
                            ttl,
                            dependenciesBytes,
                        ),
                        DeployUtil.ExecutableDeployItem.newStoredContractByHash(
                            contractHashAsByteArray,
                            ep.name,
                            RuntimeArgs.fromMap(argMap)
                        ),
                        DeployUtil.standardPayment(paymentAmount),
                    )

                    // Sign deploy.
                    deploy = client.signDeploy(deploy, keys)

                    // Dispatch deploy to node.
                    const deployHash = await client.putDeploy(deploy)
                    return deployHash
                }
            }
        }
    }

    /**
     * This function parses events from a Casper deploy based on specified event specifications and a
     * contract package hash.
     * @param eventSpecs - `eventSpecs` is an object mapping from event name to a list of named fields emited by events
     * for example: eventSpecs = {
     *       request_bridge_erc20: ["contract_package_hash", "event_type", "erc20_contract", "request_index"],
     *       unlock_erc20: ["contract_package_hash", "event_type", "erc20_contract", "amount", "from", "to", "unlock_id"]
     *       }
     * @param deployExecutionResult - `deployExecutionResult` is an object that represents a deployment transaction on the Casper
     * blockchain. It contains information about the deployed contract, such as the execution result
     * and any associated transforms. This object is used in the `parseEvents` function to extract
     * events emitted by the deployed contract.
     */
    static parseEvents(eventSpecs, deployExecutionResult, contractPackageHash) {
        const eventNames = Object.keys(eventSpecs)
        for (const en of eventNames) {
            if (!eventSpecs[en].includes('contract_package_hash')) {
                eventSpecs[en].push('contract_package_hash')
            }

            if (!eventSpecs[en].includes('event_type')) {
                eventSpecs[en].push('event_type')
            }
        }

        if (!deployExecutionResult.errorMessage) {
            const transforms = deployExecutionResult.effects

            const eventInstances = transforms.reduce((acc, val) => {
                if (
                    val?.kind?.data && val.kind.isCLValueWrite() &&
                    typeof val.kind.data.WriteCLValue.parsed === "object" &&
                    val.kind.data.WriteCLValue.parsed !== null
                ) {
                    const clValue = val.kind.parseAsWriteCLValue()
                    if (clValue && clValue.getType().getTypeID() === CasperSDK.TypeID.Map) {
                        const clValueMap = clValue.map
                        const hash = clValueMap.get("contract_package_hash");
                        const event = clValueMap.get("event_type");
                        if (
                            hash &&
                            (hash?.stringVal?.value === contractPackageHash) &&
                            event &&
                            eventNames.includes(event?.stringVal?.value)
                        ) {
                            const data = clValueMap.getMap()
                            // check whether data has enough fields
                            const requiredFields = eventSpecs[event?.stringVal?.value.toLowerCase()]
                            const good = true
                            for (const f of requiredFields) {
                                if (!data[f]) {
                                    good = false
                                    break
                                }
                            }
                            if (good) {
                                acc = [...acc, { name: event.stringVal?.value, data }];
                            }
                        }
                    }
                }
                return acc;
            }, []);

            return { error: null, success: !!eventInstances.length, data: eventInstances };
        }

        return null;

    }

    /**
     * This function parses events for a given block number and contract package hash using a
     * CasperServiceByJsonRPC client.
     * @param eventSpecs - An object containing the specifications of the events to be parsed. It
     * includes the event names and their corresponding argument types.
     * @param blockNumber - The block number for which events need to be parsed.
     * @param contractPackageHash - The hash of the smart contract package that contains the contract
     * code being executed in the specified block.
     * @param nodeAddress - The address of the node that the CasperServiceByJsonRPC client will connect
     * to.
     * @returns an object containing the events parsed from the specified block, filtered by the
     * specified event specifications, for the specified contract package hash and node address. The
     * object has deploy hashes as keys and the corresponding parsed events as values.
     */
    static async parseEventsForBlock(eventSpecs, blockNumber, contractPackageHash, nodeAddress) {
        const client = new CasperSDK.RpcClient(new CasperSDK.HttpHandler(nodeAddress));

        const block = await client.getBlockByHeight(blockNumber);
        const deployHashes = block.block.transactions.map(e => e.hash.toHex())
        const ret = {}

        for (const h of deployHashes) {
            let deployResult = await client.getDeploy(h);
            const executionInfo = deployResult.toInfoGetTransactionResult()
            if (executionInfo.executionInfo && executionInfo.executionInfo.executionResult) {
                let result = executionInfo.executionInfo.executionResult
                if (!result.errorMessage) {
                    const events = Contract.parseEvents(eventSpecs, result, contractPackageHash)
                    if (events) {
                        ret[h] = events
                    }
                }
            }
        }

        return ret
    }

    /**
     * This function creates an instance of a smart contract using its contract hash, node address,
     * chain name, and ABI.
     * @param contractHash - The hash of the smart contract that you want to create an instance of.
     * @param nodeAddress - The nodeAddress parameter is the address of the node that the contract will
     * be deployed on. It is typically a URL or IP address.
     * @param chainName - The `chainName` parameter is a string that represents the name of the
     * blockchain network on which the smart contract is deployed. It could be the name of a public
     * blockchain network like Ethereum or a private blockchain network like Hyperledger Fabric.
     * @param abi - abi stands for "Application Binary Interface". It is a JSON file that describes the
     * interface of a smart contract, including its functions, arguments, and return types. The ABI is
     * used by clients to interact with the smart contract on the blockchain.
     * @returns The function `createInstance` returns a Promise that resolves to an instance of the
     * `Contract` class.
     */
    static async createInstance(contractPackageHash, contractHash, nodeAddress, chainName, abi) {
        const instance = new Contract(contractPackageHash, contractHash, nodeAddress, chainName, abi.namedKeys ?? [], abi.entryPoints ?? []);
        await instance.init();
        return instance;
    }

    /**
     * This function creates an instance of a contract with a remote ABI by fetching the ABI from a
     * specified API endpoint.
     * @param contractHash - The hash of the smart contract that you want to create an instance of.
     * @param nodeAddress - The `nodeAddress` parameter is the address of the node that the contract
     * instance will be connected to. This is typically a URL or IP address that points to a node
     * running on a blockchain network.
     * @param chainName - The name of the blockchain network on which the contract is deployed.
     * Examples include Ethereum, Binance Smart Chain, etc.
     * @returns a Promise that resolves to an instance of the Contract class with the specified
     * contract hash, node address, chain name, and ABI.
     */
    static async createInstanceWithRemoteABI(contractHash, nodeAddress, chainName) {
        const rpcClient = createRpcClient(nodeAddress)
        const state = await rpcClient.queryGlobalStateByStateHash(null, `hash-${contractHash}`, [])
        const ABI = state.storedValue.contract
        return await Contract.createInstance(state.storedValue.contract.contractPackageHash.hash.toHex(), contractHash, nodeAddress, chainName, ABI)
    }

    /**
     * This function retrieves information about a contract package using its hash and the state root
     * hash of a specified chain.
     * @param contractPackageHash - The hash of the contract package for which you want to retrieve
     * information.
     * @param chainName - The `chainName` parameter is a string that represents the name of the
     * blockchain network on which the contract package is deployed. It is used to retrieve the state
     * root hash and the API endpoint to get the ABI (Application Binary Interface) of the contract
     * package.
     * @returns the information of a contract package identified by its hash, including its ABI
     * (Application Binary Interface) and other metadata.
     */
    static async getPackageInfo(contractPackageHash, nodeAddress) {
        const rpcClient = createRpcClient(nodeAddress)
        const state = await rpcClient.getStateItem(null, `hash-${contractPackageHash}`, [])
        const packageInfo = state.storedValue.contractPackage
        return packageInfo
    }

    /**
     * This function retrieves the active contract hash for a given contract package hash and chain
     * name.
     * @param contractPackageHash - The hash of the contract package that contains the contract
     * version(s) you want to retrieve the active contract hash for.
     * @param chainName - The `chainName` parameter is a string that represents the name of the
     * blockchain network where the contract package is deployed. It is used to retrieve the package
     * information from the specified blockchain network.
     * @returns the hash of the latest active contract version for a given contract package hash and
     * chain name.
     */
    static async getActiveContractHash(contractPackageHash, nodeAddress) {
        const packageInfo = await Contract.getPackageInfo(contractPackageHash, nodeAddress)
        const versions = packageInfo.versions
        let lastVersion = {};
        versions.forEach(e => {
            if (!lastVersion.contractVersion || e.contractVersion > lastVersion.contractVersion) {
                lastVersion = e
            }
        })
        return lastVersion.contractHash.hash.toHex()
    }

    /**
     * This function installs a smart contract on a specified blockchain network and returns the
     * transaction hash.
     * @returns the hash of the installed contract.
     */
    static async makeInstallContractAndSend({ keys, args, paymentAmount, chainName, nodeAddress, wasmPath }) {
        const runtimeArgs = RuntimeArgs.fromMap(args);
        const wasmCodeFile = fs.readFileSync(wasmPath, null).buffer;
        const session = DeployUtil.ExecutableDeployItem.newModuleBytes(
            new Uint8Array(wasmCodeFile),
            runtimeArgs
        );
        const deployParams = new DeployUtil.DeployParams(CasperSDK.CLPublicKey.fromHex(keys.publicKey.toHex()), chainName)
        const payment = DeployUtil.standardPayment(paymentAmount);
        const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

        const client = new CasperClient(nodeAddress);
        const signedDeploy = client.signDeploy(deploy, keys)
        const hash = await client.putDeploy(signedDeploy);
        return hash
    }

    /**
     * Creates an unsigned deploy to install a contract on the Casper network.
     * 
     * @param {Object} options - Installation options object
     * @param {Object} options.keys - Object containing keys information
     * @param {import("casper-js-sdk").PublicKey} options.keys.publicKey - The public key of the account installing the contract
     * @param {String} options.wasmPath - Path to the contract's WASM file or raw WASM bytes
     * @param {Record<string, CLValue>} options.args - Arguments to pass to the contract constructor
     * @param {Number | String} options.paymentAmount - Amount in motes to pay for the deploy execution
     * @param {String} [options.chainName="casper"] - Name of the chain to deploy to
     * @param {Number} [options.ttl=1800000] - Time to live for the deploy in milliseconds
     * @param {Number} [options.gasPrice=1] - Gas price for the deploy
     * @param {String} [options.dependencies=[]] - List of deploy hashes this deploy depends on
     * 
     * @returns {Deploy} An unsigned deploy object ready to be signed
     */
    static async makeUnsignedInstallContract({ keys, args, paymentAmount, chainName, wasmPath, ttl = DEFAULT_TTL }) {
        const runtimeArgs = CasperSDK.Args.fromMap(args);
        const wasmCodeFile = fs.readFileSync(wasmPath, null).buffer;
        const session = CasperSDK.ExecutableDeployItem.newModuleBytes(
            new Uint8Array(wasmCodeFile),
            runtimeArgs
        );
        const deployHeader = CasperSDK.DeployHeader.default()
        deployHeader.account = keys.publicKey
        deployHeader.chainName = chainName
        deployHeader.ttl = new CasperSDK.Duration(ttl)

        const payment = CasperSDK.ExecutableDeployItem.standardPayment(paymentAmount);
        return CasperSDK.Deploy.makeDeploy(deployHeader, payment, session)
    }


    static async putSignatureAndSend(
        publicKey,
        deploy,
        signature,
        nodeAddress,
    ) {
        const client = createRpcClient(nodeAddress)
        const algBytes = Uint8Array.of(publicKey.cryptoAlg)
        signature = [...algBytes, ...signature]
        const approval = new CasperSDK.Approval(publicKey, new CasperSDK.HexBytes(signature))
        deploy.approvals.push(approval)
        const deployHash = await client.putDeploy(deploy)
        return deployHash.deployHash.toHex()
    }

    /**
     * This function decodes data using a given set of types.
     * @param data - The `data` parameter is the input data that needs to be decoded. It can be either
     * a string of hexadecimal characters or a Uint8Array.
     * @param types - an array of parameter types that need to be decoded from the input data.
     * @returns The function `decodeData` returns an array of decoded values based on the input `data`
     * and `types`.
     */
    static decodeData(data, types) {
        if (typeof data == 'string') {
            data = Uint8Array.from(Buffer.from(data, 'hex'))
        }
        let remainder = data
        const ret = []
        for (var t of types) {
            let { remainder: r, value: v } = deserializeParam(t, remainder)
            remainder = r
            ret.push(v)
        }
        return ret
    }

    static decodeDataWithRemainder(data, types) {
        if (typeof data == 'string') {
            data = Uint8Array.from(Buffer.from(data, 'hex'))
        }
        let remainder = data
        const ret = []
        for (var t of types) {
            let { remainder: r, value: v } = deserializeParam(t, remainder)
            remainder = r
            ret.push(v)
        }
        return { remainder, values: ret }
    }

    static deployToJson(d) {
        return CasperSDK.Deploy.toJSON(d)
    }

    static deployFromJson(d) {
        return CasperSDK.Deploy.fromJSON(d)
    }
}

module.exports = {
    Contract,
    serializeParam
}