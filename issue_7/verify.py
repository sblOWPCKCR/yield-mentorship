# import manticore

import os
import re
import sys
import argparse
import logging
import pkg_resources
from itertools import chain
from manticore.ethereum import ManticoreEVM
from manticore.ethereum.detectors import DetectIntegerOverflow
from manticore.ethereum.plugins import FilterFunctions, VerboseTrace, KeepOnlyIfStorageChanges
from manticore.core.smtlib.operators import OR, NOT, AND
from manticore.ethereum.abi import ABI
from manticore.utils.log import set_verbosity
from prettytable import PrettyTable
from manticore.utils import config
from manticore.utils.nointerrupt import WithKeyboardInterruptAs

def main():
    return manticore_verifier("contracts/GreenAMM.sol",
        contract_name="GreenAMMTest",
        compile_args={"solc_remaps": "@yield-protocol=node_modules/@yield-protocol"},
        timeout=3600
        # compile_args={'compile_force_framework': None, 
        #     'compile_remove_metadata': False, 'compile_custom_build': None, 'ignore_compile': False, 'solc': 'solc',
        #     'solc_remaps': '@yield-protocol=/Users/moriarty/src/yield-training/issue_6/node_modules/@yield-protocol', 
        #     'solc_args': None, 'solc_disable_warnings': False, 'solc_working_dir': None, 'solc_solcs_select': None, 'solc_solcs_bin': None, 'solc_standard_json': False, 'solc_force_legacy_json': False, 'truffle_ignore_compile': False, 'truffle_build_directory': 'build/contracts', 'truffle_version': None, 'truffle_overwrite_config': False, 'truffle_overwrite_version': None, 'embark_ignore_compile': False, 'embark_overwrite_config': False, 'dapp_ignore_compile': False, 'etherlime_ignore_compile': False, 'etherlime_compile_arguments': None, 'etherscan_only_source_code': False, 'etherscan_only_bytecode': False, 'etherscan_api_key': None, 'etherscan_export_dir': 'etherscan-contracts', 'waffle_ignore_compile': False, 'waffle_config_file': None, 'npx_disable': False, 'buidler_ignore_compile': False, 'buidler_cache_directory': 'cache', 'buidler_skip_directory_name_fix': False, 'hardhat_ignore_compile': False, 'hardhat_cache_directory': 'cache', 'hardhat_artifacts_directory': 'artifacts', 'source_code': ['/Users/moriarty/src/yield-training/issue_6/contracts/GreenAMM.sol'], 'v': 0, 'workspace': None, 'propconfig': None, 'thorough_mode': False, 'contract_name': 'GreenAMMTest', 'maxfail': None, 'maxcov': 100, 'maxt': 3, 'deployer': None, 'senders': None, 'psender': None, 'propre': 'crytic_.*', 'timeout': 240, 'outputspace_url': None, 'core.compress_states': True, 'core.execs_per_intermittent_cb': 1000, 'core.HOST': 'localhost', 'core.PORT': 3214, 'core.timeout': 0, 'core.cluster': False, 'core.procs': 12, 'core.mprocessing': <MProcessingType.threading: 'threading'>, 'core.seed': 2688316786, 'smt.timeout': 120, 'smt.memory': 8192, 'smt.maxsolutions': 10000, 'smt.z3_bin': 'z3', 'smt.cvc4_bin': 'cvc4', 'smt.yices_bin': 'yices-smt2', 'smt.boolector_bin': 'boolector', 'smt.defaultunsat': True, 'smt.optimize': True, 'smt.solver': <SolverType.auto: 'auto'>, 'workspace.prefix': 'mcore_', 'workspace.dir': '.', 'evm.oog': 'ignore', 'evm.txfail': 'optimistic', 'evm.calldata_max_offset': 1048576, 'evm.calldata_max_size': -1, 'evm.ignore_balance': False, 'evm.defaultgas': 3000000, 'evm.sha3': <Sha3Type.symbolicate: 'symbolicate'>, 'evm.sha3timeout': 3600, 'evm.events': False}
    )

def manticore_verifier(
    source_code,
    contract_name,
    maxfail=None,
    maxt=3,
    maxcov=100,
    deployer=None,
    senders=None,
    psender=None,
    propre=r"crytic_.*",
    compile_args=None,
    outputspace_url=None,
    timeout=100,
):
    """Verify solidity properties
    The results are dumped to stdout and to the workspace folder.

        $manticore-verifier property.sol  --contract TestToken --smt.solver yices --maxt 4
        # Owner account: 0xf3c67ffb8ab4cdd4d3243ad247d0641cd24af939
        # Contract account: 0x6f4b51ac2eb017600e9263085cfa06f831132c72
        # Sender_0 account: 0x97528a0c7c6592772231fd581e5b42125c1a2ff4
        # PSender account: 0x97528a0c7c6592772231fd581e5b42125c1a2ff4
        # Found 2 properties: crytic_test_must_revert, crytic_test_balance
        # Exploration will stop when some of the following happens:
        # * 4 human transaction sent
        # * Code coverage is greater than 100% meassured on target contract
        # * No more coverage was gained in the last transaction
        # * At least 2 different properties where found to be breakable. (1 for fail fast)
        # * 240 seconds pass
        # Starting exploration...
        Transactions done: 0. States: 1, RT Coverage: 0.0%, Failing properties: 0/2
        Transactions done: 1. States: 2, RT Coverage: 55.43%, Failing properties: 0/2
        Transactions done: 2. States: 8, RT Coverage: 80.48%, Failing properties: 1/2
        Transactions done: 3. States: 30, RT Coverage: 80.48%, Failing properties: 1/2
        No coverage progress. Stopping exploration.
        Coverage obtained 80.48%. (RT + prop)
        +-------------------------+------------+
        |      Property Named     |   Status   |
        +-------------------------+------------+
        |   crytic_test_balance   | failed (0) |
        | crytic_test_must_revert |   passed   |
        +-------------------------+------------+
        Checkout testcases here:./mcore_6jdil7nh

    :param maxfail: stop after maxfail properties are failing. All if None
    :param maxcov: Stop after maxcov % coverage is obtained in the main contract
    :param maxt: Max transaction count to explore
    :param deployer: (optional) address of account used to deploy the contract
    :param senders: (optional) a list of calles addresses for the exploration
    :param psender: (optional) address from where the property is tested
    :param source_code: A filename or source code
    :param contract_name: The target contract name defined in the source code
    :param propre: A regular expression for selecting properties
    :param outputspace_url: where to put the extended result
    :param timeout: timeout in seconds
    :return:
    """
    # Termination condition
    # Exploration will stop when some of the following happens:
    # * MAXTX human transaction sent
    # * Code coverage is greater than MAXCOV meassured on target contract
    # * No more coverage was gained in the last transaction
    # * At least MAXFAIL different properties where found to be breakable. (1 for fail fast)

    # Max transaction count to explore
    MAXTX = maxt
    # Max coverage % to get
    MAXCOV = maxcov
    # Max different properties fails
    MAXFAIL = maxfail

    config.get_group("smt").timeout = 120
    config.get_group("smt").memory = 16384
    config.get_group("evm").ignore_balance = True
    config.get_group("evm").oog = "ignore"

    print("# Welcome to manticore-verifier")
    # Main manticore manager object
    m = ManticoreEVM()
    # avoid all human level tx that are marked as constant (have no effect on the storage)
    filter_out_human_constants = FilterFunctions(
        regexp=r".*", depth="human", mutability="constant", include=False
    )
    m.register_plugin(filter_out_human_constants)
    filter_out_human_constants.disable()

    # Avoid automatically exploring property
    filter_no_crytic = FilterFunctions(regexp=propre, include=False)
    m.register_plugin(filter_no_crytic)
    filter_no_crytic.disable()

    # Only explore properties (at human level)
    filter_only_crytic = FilterFunctions(regexp=propre, depth="human", fallback=False, include=True)
    m.register_plugin(filter_only_crytic)
    filter_only_crytic.disable()

    # And now make the contract account to analyze

    # User accounts. Transactions trying to break the property are send from one
    # of this
    senders = (None,) if senders is None else senders

    user_accounts = []
    for n, address_i in enumerate(senders):
        user_accounts.append(
            m.create_account(balance=10 ** 10, address=address_i, name=f"sender_{n}")
        )
    # the address used for deployment
    owner_account = m.create_account(balance=10 ** 10, address=deployer, name="deployer")

    dai = m.solidity_create_contract("0x6B175474E89094C44Da98b954EedeAC495271d0F", owner=owner_account, contract_name="Dai", args=(1,))
    print("DAI compiled")
    sushi = m.solidity_create_contract("0x6B3595068778DD592e39A122f4f5a5cF09C90fE2", owner=owner_account, contract_name="SushiToken")
    print("SUSHI compiled")
    # the target contract account
    contract_account = m.solidity_create_contract(
        source_code,
        owner=owner_account,
        contract_name=contract_name,
        compile_args=compile_args,
        name="contract_account",
        args=(dai, sushi),
    )
    print(f"{contract_name} compiled")
    # the address used for checking porperties
    checker_account = m.create_account(balance=10 ** 10, address=psender, name="psender")

    print(f"# Owner account: 0x{int(owner_account):x}")
    print(f"# Contract account: 0x{int(contract_account):x}")
    for n, user_account in enumerate(user_accounts):
        print(f"# Sender_{n} account: 0x{int(user_account):x}")
    print(f"# PSender account: 0x{int(checker_account):x}")

    properties = {}
    md = m.get_metadata(contract_account)
    for func_hsh in md.function_selectors:
        func_name = md.get_abi(func_hsh)["name"]
        print(f"Pondering {func_name}")
        if re.match(propre, func_name):
            print(f"It's a match!")
            properties[func_name] = []

    print(f"# Found {len(properties)} properties: {', '.join(properties.keys())}")
    if not properties:
        print("I am sorry I had to run the init bytecode for this.\n" "Good Bye.")
        return
    MAXFAIL = len(properties) if MAXFAIL is None else MAXFAIL
    tx_num = 0  # transactions count
    current_coverage = None  # obtained coverge %
    new_coverage = 0.0

    print(
        f"""# Exploration will stop when some of the following happens:
# * {MAXTX} human transaction sent
# * Code coverage is greater than {MAXCOV}% meassured on target contract
# * No more coverage was gained in the last transaction
# * At least {MAXFAIL} different properties where found to be breakable. (1 for fail fast)
# * {timeout} seconds pass"""
    )
    print("# Starting exploration...")
    print(
        f"Transactions done: {tx_num}. States: {m.count_ready_states()}, RT Coverage: {0.00}%, "
        f"Failing properties: 0/{len(properties)}"
    )
    with m.kill_timeout(timeout=timeout):
        while not m.is_killed():
            # check if we found a way to break more than MAXFAIL properties
            broken_properties = sum(int(len(x) != 0) for x in properties.values())
            if broken_properties >= MAXFAIL:
                print(
                    f"Found {broken_properties}/{len(properties)} failing properties. Stopping exploration."
                )
                break

            # check if we sent more than MAXTX transaction
            if tx_num >= MAXTX:
                print(f"Max number of transactions reached ({tx_num})")
                break
            tx_num += 1

            # check if we got enough coverage
            new_coverage = m.global_coverage(contract_account)
            if new_coverage >= MAXCOV:
                print(
                    f"Current coverage({new_coverage}%) is greater than max allowed ({MAXCOV}%). Stopping exploration."
                )
                break

            # check if we have made coverage progress in the last transaction
            if current_coverage == new_coverage:
                print(f"No coverage progress. Stopping exploration.")
                break
            current_coverage = new_coverage

            # Make sure we didn't time out before starting first transaction
            if m.is_killed():
                print("Cancelled or timeout.")
                break

            # Explore all methods but the "crytic_" properties
            # Note: you may be tempted to get all valid function ids/hashes from the
            #  metadata and to constrain the first 4 bytes of the calldata here.
            #  This wont work because we also want to prevent the contract to call
            #  crytic added methods as internal transactions
            filter_no_crytic.enable()  # filter out crytic_porperties
            filter_out_human_constants.enable()  # Exclude constant methods
            filter_only_crytic.disable()  # Exclude all methods that are not property checks

            symbolic_data = m.make_symbolic_buffer(320)
            symbolic_value = m.make_symbolic_value()
            caller_account = m.make_symbolic_value(160)
            args = tuple((caller_account == address_i for address_i in user_accounts))

            m.constrain(OR(*args, False))
            m.transaction(
                caller=caller_account,
                address=contract_account,
                value=symbolic_value,
                data=symbolic_data,
            )

            # check if timeout was requested during the previous transaction
            if m.is_killed():
                print("Cancelled or timeout.")
                break

            m.clear_terminated_states()  # no interest in reverted states
            m.take_snapshot()  # make a copy of all ready states
            print(
                f"Transactions done: {tx_num}. States: {m.count_ready_states()}, "
                f"RT Coverage: {m.global_coverage(contract_account):3.2f}%, "
                f"Failing properties: {broken_properties}/{len(properties)}"
            )

            # check if timeout was requested while we were taking the snapshot
            if m.is_killed():
                print("Cancelled or timeout.")
                break

            # And now explore all properties (and only the properties)
            filter_no_crytic.disable()  # Allow crytic_porperties
            filter_out_human_constants.disable()  # Allow them to be marked as constants
            filter_only_crytic.enable()  # Exclude all methods that are not property checks
            symbolic_data = m.make_symbolic_buffer(4)
            m.transaction(
                caller=checker_account, address=contract_account, value=0, data=symbolic_data
            )

            for state in m.all_states:
                world = state.platform
                tx = world.human_transactions[-1]
                md = m.get_metadata(tx.address)
                """
                A is _broken_ if:
                     * is normal property
                     * RETURN False
                   OR:
                     * property name ends with 'revert'
                     * does not REVERT
                Property is considered to _pass_ otherwise
                """
                N = constrain_to_known_func_ids(state)
                for func_id in map(bytes, state.solve_n(tx.data[:4], nsolves=N)):
                    func_name = md.get_abi(func_id)["name"]
                    if not func_name.endswith("revert"):
                        # Property does not ends in "revert"
                        # It must RETURN a 1
                        if tx.return_value == 1:
                            # TODO: test when property STOPs
                            return_data = ABI.deserialize("bool", tx.return_data)
                            testcase = m.generate_testcase(
                                state,
                                f"property {md.get_func_name(func_id)} is broken",
                                only_if=AND(tx.data[:4] == func_id, return_data == 0),
                            )
                            if testcase:
                                properties[func_name].append(testcase.num)
                    else:
                        # property name ends in "revert" so it MUST revert
                        if tx.result != "REVERT":
                            testcase = m.generate_testcase(
                                state,
                                f"Some property is broken did not reverted.(MUST REVERTED)",
                                only_if=tx.data[:4] == func_id,
                            )
                            if testcase:
                                properties[func_name].append(testcase.num)

            m.clear_terminated_states()  # no interest in reverted states for now!
            m.goto_snapshot()
        else:
            print("Cancelled or timeout.")

    m.clear_terminated_states()
    m.clear_ready_states()
    m.clear_snapshot()

    if m.is_killed():
        print("Exploration ended by CTRL+C or timeout")

    print(f"Coverage obtained {new_coverage:3.2f}%. (RT + prop)")

    x = PrettyTable()
    x.field_names = ["Property Named", "Status"]
    for name, testcases in sorted(properties.items()):
        result = "passed"
        if testcases:
            result = f"failed ({testcases[0]})"
        x.add_row((name, result))
    print(x)

    m.clear_ready_states()

    workspace = os.path.abspath(m.workspace)[len(os.getcwd()) + 1 :]
    print(f"Checkout testcases here:./{workspace}")


def constrain_to_known_func_ids(state):
    world = state.platform
    tx = world.human_transactions[-1]
    md = state.manticore.get_metadata(tx.address)

    N = 0
    is_normal = False
    func_id = tx.data[:4]
    for func_hsh in md.function_selectors:
        N += 1
        is_normal = OR(func_hsh == func_id, is_normal)
    is_fallback = NOT(is_normal)
    is_known_func_id = is_normal

    chosen_fallback_func_is = None
    if state.can_be_true(is_fallback):
        with state as temp_state:
            temp_state.constraint(is_fallback)
            chosen_fallback_func_id = bytes(state.solve_one(tx.data[:4]))
            is_known_func_id = OR(is_known_func_id, chosen_fallback_func_id == func_id)
            N += 1
    state.constrain(is_known_func_id)
    return N


if __name__ == "__main__":
    main()