const {
    utils,
    helpers,
    CasperContractClient,
} = require("casper-js-client-helper");
const { RequestManager, HTTPTransport, Client } = require("@open-rpc/client-js")

const { CLValueBuilder, RuntimeArgs, LIST_TYPE, BYTE_ARRAY_TYPE, MAP_TYPE, TUPLE1_TYPE, TUPLE2_TYPE, TUPLE3_TYPE, OPTION_TYPE, RESULT_TYPE, CLValueParsers, CLTypeTag, CasperServiceByJsonRPC, CasperClient, DeployUtil, Keys, matchTypeToCLType, CLTuple2Type } = require("casper-js-sdk");
const CasperSDK = require('casper-js-sdk')
const { setClient, contractSimpleGetter, installContract } = helpers;
const axios = require('axios');
const { DEFAULT_TTL } = require("casper-js-client-helper/dist/constants");

function getNetwork(networkName) {
    return networkName == 'casper' ? 'mainnet' : (networkName == 'casper-test' ? 'testnet' : 'intnet')
}

function getAPIToGetABI(networkName) {
    return `https://event-store-api-clarity-${getNetwork(networkName)}.make.services/rpc/state_get_item`
}

async function getStateRootHash(networkName) {
    const url = `https://event-store-api-clarity-${getNetwork(networkName)}.make.services/rpc/info_get_status`
    const data = await axios.get(url)
    return data.data.result.last_added_block_info.state_root_hash
}

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
        case CasperSDK.BOOL_TYPE:
            return CLValueBuilder.bool(v)
        case CasperSDK.KEY_TYPE:
            return CLValueBuilder.key(v)
        case CasperSDK.PUBLIC_KEY_TYPE:
            return CLValueBuilder.publicKey(v)
        case CasperSDK.STRING_TYPE:
            return CLValueBuilder.string(v)
        case CasperSDK.UREF_TYPE:
            return CLValueBuilder.uref(v, CasperSDK.AccessRights.None)
        case CasperSDK.UNIT_TYPE:
            return CLValueBuilder.unit()
        case CasperSDK.I32_TYPE:
            return CLValueBuilder.i32(v)
        case CasperSDK.I64_TYPE:
            return CLValueBuilder.i64(v)
        case CasperSDK.U8_TYPE:
            return CLValueBuilder.u8(v)
        case CasperSDK.U32_TYPE:
            return CLValueBuilder.u32(v)
        case CasperSDK.U64_TYPE:
            return CLValueBuilder.u64(v)
        case CasperSDK.U128_TYPE:
            return CLValueBuilder.u128(v)
        case CasperSDK.U256_TYPE:
            return CLValueBuilder.u256(v)
        case CasperSDK.U512_TYPE:
            return CLValueBuilder.u512(v)
        default:
            break;
    }

    const type = t
    if (typeof type === typeof {}) {
        if (LIST_TYPE in type) {
          const inner = matchTypeToCLType(type[LIST_TYPE]);
          return CLValueBuilder.list(v.map(e => serializeParam(inner.toString(), e)))
        }
        if (BYTE_ARRAY_TYPE in type) {
          // const size = type[BYTE_ARRAY_TYPE];
          return CLValueBuilder.byteArray(v)
        }
        if (MAP_TYPE in type) {
          const keyType = matchTypeToCLType(type[MAP_TYPE].key);
          const valType = matchTypeToCLType(type[MAP_TYPE].value);
          const mapItems = v.map(e => [serializeParam(keyType, e[0]), serializeParam(valType, e[1])])          
          return CLValueBuilder.map(mapItems)
        }
        if (TUPLE1_TYPE in type) {
          const vals = type[TUPLE1_TYPE].map((t) => matchTypeToCLType(t));
          const ret = []
          for(var i = 0; i < vals.length; i++) {
            ret.push(serializeParam(vals[i].toString(), v[i]))
          }
          return CLValueBuilder.tuple1(ret)
        }
        if (TUPLE2_TYPE in type) {
          const vals = type[TUPLE2_TYPE].map((t) => matchTypeToCLType(t));
          const ret = []
          for(var i = 0; i < vals.length; i++) {
            ret.push(serializeParam(vals[i].toString(), v[i]))
          }
          return CLValueBuilder.tuple2(ret)
        }
        if (TUPLE3_TYPE in type) {
          const vals = type[TUPLE3_TYPE].map((t) => matchTypeToCLType(t));
          const ret = []
          for(var i = 0; i < vals.length; i++) {
            ret.push(serializeParam(vals[i].toString(), v[i]))
          }
          return CLValueBuilder.tuple3(ret)
        }
        if (OPTION_TYPE in type) {
          const inner = matchTypeToCLType(type[OPTION_TYPE]);
          // return CLValueBuilder.option()
        }
        if (RESULT_TYPE in type) {
            return
        }
        throw new Error(`The complex type ${type} is not supported`);
      }
}

/**
 * The function creates an instance of a specific type based on the input type name.
 * @param t - The parameter `t` is a string representing the type name of a Casper contract type.
 * @returns The function `createInstanceFromTypeName` returns an instance of a class based on the input
 * `t`, which is a string representing the type name. The specific class instance returned depends on
 * the value of `t` and is determined by the switch statement.
 */
function createInstanceFromTypeName(t) {
    switch (t) {
        case CasperSDK.BOOL_TYPE :
            return new CasperSDK.CLBoolType()
        case CasperSDK.KEY_TYPE:
            return new CasperSDK.CLKeyType()
        case CasperSDK.PUBLIC_KEY_TYPE:
            return new CasperSDK.CLPublicKeyType()
        case CasperSDK.STRING_TYPE:
            return new CasperSDK.CLStringType()
        case CasperSDK.UREF_TYPE:
            return new CasperSDK.CLURefType()
        case CasperSDK.UNIT_TYPE:
            return new CasperSDK.CLUnitType()
        case CasperSDK.I32_TYPE:
            return new CasperSDK.CLI32Type()
        case CasperSDK.I64_TYPE:
            return new CasperSDK.CLI64Type()
        case CasperSDK.U8_TYPE:
            return new CasperSDK.CLU8Type()
        case CasperSDK.U32_TYPE:
            return new CasperSDK.CLU32Type()
        case CasperSDK.U64_TYPE:
            return new CasperSDK.CLU64Type()
        case CasperSDK.U128_TYPE:
            return new CasperSDK.CLU128Type()
        case CasperSDK.U256_TYPE:
            return new CasperSDK.CLU256Type()
        case CasperSDK.U512_TYPE:
            return new CasperSDK.CLU512Type()
        default:
            break;
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
function deserializeParam(t, v) {
    let ret
    switch (t) {
        case CasperSDK.BOOL_TYPE:
            ret = new CasperSDK.CLBoolBytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.KEY_TYPE:
            ret = new CasperSDK.CLKeyBytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.PUBLIC_KEY_TYPE:
            ret = new CasperSDK.CLPublicKeyBytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.STRING_TYPE:
            ret = new CasperSDK.CLStringBytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.UREF_TYPE:
            ret = new CasperSDK.CLURefBytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.UNIT_TYPE:
            ret = new CasperSDK.CLUnitBytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.I32_TYPE:
            ret = new CasperSDK.CLI32BytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.I64_TYPE:
            ret = new CasperSDK.CLI64BytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.U8_TYPE:
            ret = new CasperSDK.CLU8BytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.U32_TYPE:
            ret = new CasperSDK.CLU32BytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.U64_TYPE:
            ret = new CasperSDK.CLU64BytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.U128_TYPE:
            ret = new CasperSDK.CLU128BytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.U256_TYPE:
            ret = new CasperSDK.CLU256BytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        case CasperSDK.U512_TYPE:
            ret = new CasperSDK.CLU512BytesParser().fromBytesWithRemainder(v)
            return { remainder: ret.remainder, value: ret.result.val.value() }
        default:
            break;
    }
    const type = t
    if (typeof type === typeof {}) {
        if (LIST_TYPE in type) {
          const inner = matchTypeToCLType(type[LIST_TYPE]);
          ret = new CasperSDK.CLListBytesParser().fromBytesWithRemainder(v, new CasperSDK.CLListType(createInstanceFromTypeName(inner.toString())))
          return { remainder: ret.remainder, value: ret.result.val.value() }
        }
        if (BYTE_ARRAY_TYPE in type) {
            return
            // ret = new CasperSDK.CLByteArrayBytesParser().fromBytesWithRemainder(v)
            // return CLValueBuilder.byteArray(v)
        }
        if (MAP_TYPE in type) {
          const keyType = matchTypeToCLType(type[MAP_TYPE].key);
          const valType = matchTypeToCLType(type[MAP_TYPE].value);
          ret = new CasperSDK.CLMapBytesParser().fromBytesWithRemainder(v, new CasperSDK.CLMapType([createInstanceFromTypeName(keyType.toString()), createInstanceFromTypeName(valType.toString())]))
          return { remainder: ret.remainder, value: ret.result.val.value() }
        }
        if (TUPLE1_TYPE in type) {
          return
        }
        if (TUPLE2_TYPE in type) {
          return
        }
        if (TUPLE3_TYPE in type) {
          return
        }
        if (OPTION_TYPE in type) {
          return
        }
        if (RESULT_TYPE in type) {
            return
        }
        throw new Error(`The complex type ${type} is not supported`);
      }
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

    /**
     * This function initializes a JavaScript object with various properties and methods for
     * interacting with a smart contract on a blockchain network.
     */
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

    /**
     * This function creates getter functions for a smart contract in JavaScript.
     * @returns This code is defining a function `createGetterFunctions()` that does not return
     * anything. It creates getter functions for named keys in a contract and assigns them to the
     * `getter` object.
     */
    async createGetterFunctions() {
        const nodeAddress = this.nodeAddress
        const contractHash = this.contractHash
        const chainName = this.chainName
        const namedKeys = this.namedKeys
        for (const _nk of this.namedKeysList) {
            const nk = utils.camelCased(_nk)
            this.getter[`${nk}`] = async function (itemKey, isRaw) {
                try {
                    const uref = namedKeys[nk]
                    const stateRootHash = await getStateRootHash(chainName)
                    let stateOfNK = await axios.get(`https://event-store-api-clarity-${getNetwork(chainName)}.make.services/rpc/state_get_item?state_root_hash=${stateRootHash}&key=${uref}`)
                    stateOfNK = stateOfNK.data.result.stored_value.CLValue
                    if (stateOfNK) {
                        if (stateOfNK.cl_type == 'Unit') {
                            if (isRaw) {
                                const transport = new HTTPTransport(nodeAddress);
                                const client = new Client(new RequestManager([transport]));
                                const res = await client.request({
                                    method: 'state_get_dictionary_item',
                                    params: {
                                        state_root_hash: stateRootHash,
                                        dictionary_identifier: {
                                            URef: {
                                                seed_uref: uref,
                                                dictionary_item_key: itemKey
                                            }
                                        }
                                    }
                                });
                                let storedValueJson;
                                if (res.error) {
                                    throw new Error("Cannot read raw data")
                                } else {
                                    storedValueJson = res.stored_value;
                                }
                                const rawBytes = Uint8Array.from(Buffer.from(storedValueJson.CLValue.bytes, 'hex'))
                                return rawBytes
                            }
                            // reading here
                            const result = await utils.contractDictionaryGetter(
                                nodeAddress,
                                itemKey.toString(),
                                uref
                            );
                            return result
                        } else {
                            if (isRaw) {
                                const transport = new HTTPTransport(nodeAddress);
                                const client = new Client(new RequestManager([transport]));
                                const res = await client.request({
                                    method: 'state_get_item',
                                    params: {
                                        state_root_hash: stateRootHash,
                                        key: "hash-" + contractHash,
                                        path: [_nk]
                                    }
                                });
                                let storedValueJson;
                                if (res.error) {
                                    throw new Error("Cannot read raw data")
                                } else {
                                    storedValueJson = res.stored_value;
                                }
                                const rawBytes = Uint8Array.from(Buffer.from(storedValueJson.CLValue.bytes, 'hex'))
                                return rawBytes
                            }

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

    /**
     * This function creates and returns methods for making unsigned deploys and sending deploys for a
     * given smart contract and its entry points.
     * @returns The `createMethods()` function does not have a return statement, so it does not return
     * anything.
     */
    async createMethods() {
        const contractHash = this.contractHash
        const chainName = this.chainName
        const entryPoints = this.entryPoints
        for (const ep of entryPoints) {
            const epName = utils.camelCased(ep.name)
            const contractClient = this.contractClient
            this.contractCalls[`${epName}`] = {
                makeUnsignedDeploy: async function ({ publicKey, args = {}, paymentAmount, ttl = DEFAULT_TTL }) {
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
                makeDeployAndSend: async function ({ keys, args = {}, paymentAmount, ttl = DEFAULT_TTL }) {
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

    /**
     * This function parses events from a Casper deploy based on specified event specifications and a
     * contract package hash.
     * @param eventSpecs - `eventSpecs` is an object mapping from event name to a list of named fields emited by events
     * for example: eventSpecs = {
     *       request_bridge_erc20: ["contract_package_hash", "event_type", "erc20_contract", "request_index"],
     *       unlock_erc20: ["contract_package_hash", "event_type", "erc20_contract", "amount", "from", "to", "unlock_id"]
     *       }
     * @param deploy - `deploy` is an object that represents a deployment transaction on the Casper
     * blockchain. It contains information about the deployed contract, such as the execution result
     * and any associated transforms. This object is used in the `parseEvents` function to extract
     * events emitted by the deployed contract.
     */
    static parseEvents(eventSpecs, deploy, contractPackageHash) {
        const eventNames = Object.keys(eventSpecs)
        for (const en of eventNames) {
            if (!eventSpecs[en].includes('contract_package_hash')) {
                eventSpecs[en].push('contract_package_hash')
            }

            if (!eventSpecs[en].includes('event_type')) {
                eventSpecs[en].push('event_type')
            }
        }

        const value = deploy

        if (value.execution_result.result.Success) {
            const { transforms } =
                value.execution_result.result.Success.effect;

            const eventInstances = transforms.reduce((acc, val) => {
                if (
                    val.transform.hasOwnProperty("WriteCLValue") &&
                    typeof val.transform.WriteCLValue.parsed === "object" &&
                    val.transform.WriteCLValue.parsed !== null
                ) {
                    const maybeCLValue = CLValueParsers.fromJSON(
                        val.transform.WriteCLValue
                    );
                    const clValue = maybeCLValue.unwrap();
                    if (clValue && clValue.clType().tag === CLTypeTag.Map) {
                        const hash = (clValue).get(
                            CLValueBuilder.string("contract_package_hash")
                        );
                        const event = (clValue).get(CLValueBuilder.string("event_type"));
                        if (
                            hash &&
                            (hash.data === contractPackageHash) &&
                            event &&
                            eventNames.includes(event.data)
                        ) {
                            const data = {}
                            for (const c of clValue.data) {
                                data[c[0].data] = c[1].data
                            }
                            // check whether data has enough fields
                            const requiredFields = eventSpecs[event.value().toLowerCase()]
                            const good = true
                            for (const f of requiredFields) {
                                if (!data[f]) {
                                    good = false
                                    break
                                }
                            }
                            if (good) {
                                acc = [...acc, { name: event.value(), data }];
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
        const client = new CasperServiceByJsonRPC(
            nodeAddress
        );

        const block = await client.getBlockInfoByHeight(blockNumber);
        const deployHashes = block.block.body.deploy_hashes;
        const ret = {}

        for (const h of deployHashes) {
            let deployResult = await client.getDeployInfo(h);
            if (deployResult.execution_results) {
                let result = deployResult.execution_results[0];
                if (result.result.Success) {
                    const events = await Contract.parseEvents(eventSpecs, deployResult, contractPackageHash)
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
    static async createInstance(contractHash, nodeAddress, chainName, abi) {
        const namedKeysList = (abi.named_keys ? abi.named_keys : []).map(e => e.name)
        const instance = new Contract(contractHash, nodeAddress, chainName, namedKeysList, abi.entry_points ? abi.entry_points : []);
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
        const apiToGetABI = getAPIToGetABI(chainName)
        const stateRootHash = await getStateRootHash(chainName)
        const data = await axios.get(`${apiToGetABI}?state_root_hash=${stateRootHash}&key=hash-${contractHash}`)
        const ABI = data.data.result.stored_value.Contract
        return await Contract.createInstance(contractHash, nodeAddress, chainName, ABI)
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
    static async getPackageInfo(contractPackageHash, chainName) {
        const stateRootHash = await getStateRootHash(chainName)
        const data = await axios.get(`${getAPIToGetABI(chainName)}?state_root_hash=${stateRootHash}&key=hash-${contractPackageHash}`)
        const packageInfo = data.data.result.stored_value.ContractPackage
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
    static async getActiveContractHash(contractPackageHash, chainName) {
        const packageInfo = await Contract.getPackageInfo(contractPackageHash, chainName)
        const versions = packageInfo.versions
        let lastVersion = {};
        versions.forEach(e => {
            if (!lastVersion.contract_version || e.contract_version > lastVersion.contract_version) {
                lastVersion = e
            }
        })
        return lastVersion.contract_hash.substring("contract-".length)
    }

    /**
     * This function installs a smart contract on a specified blockchain network and returns the
     * transaction hash.
     * @returns the hash of the installed contract.
     */
    static async makeInstallContractAndSend({ keys, args, paymentAmount, chainName, nodeAddress, wasmPath }) {
        const runtimeArgs = RuntimeArgs.fromMap(args);

        const hash = await installContract(
            chainName,
            nodeAddress,
            keys,
            runtimeArgs,
            paymentAmount,
            wasmPath,
        );
        return hash
    }

    static async putSignatureAndSend(
        publicKey ,
        deploy,
        signature,
        nodeAddress,
      ) {
        const client = new CasperClient(nodeAddress)
        const approval = new DeployUtil.Approval()
        approval.signer = publicKey.toHex()
        if (publicKey.isEd25519()) {
          approval.signature = Keys.Ed25519.accountHex(signature)
        } else {
          approval.signature = Keys.Secp256K1.accountHex(signature)
        }
    
        deploy.approvals.push(approval)
    
        const deployHash = await client.putDeploy(deploy)
        return deployHash
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
        for(var t of types) {
            let { remainder: r, value: v } = deserializeParam(t, remainder)
            remainder = r
            ret.push(v)            
        }
        return ret
    }

    static deployToJson(d) {
        return DeployUtil.deployToJson(d)
    }

    static deployFromJson(d) {
        return DeployUtil.deployFromJson(d)
    }
}

module.exports = {
    Contract,
    serializeParam
}