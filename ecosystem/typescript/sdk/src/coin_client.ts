// Copyright (c) Aptos
// SPDX-License-Identifier: Apache-2.0

import { AptosAccount } from "./aptos_account";
import { AptosClient } from "./aptos_client";
import * as Gen from "./generated/index";
import { HexString } from "./hex_string";
import { BCS, TxnBuilderTypes, TransactionBuilderABI } from "./transaction_builder";
import { TOKEN_ABIS } from "./token_client_abis";
import { TypeTagParser } from "./transaction_builder/builder_utils";

export const APTOS_COIN_RAW = "0x1::aptos_coin::AptosCoin";
export const APTOS_COIN = new TypeTagParser(APTOS_COIN_RAW).parseTypeTag();

/**
 * Class for creating, minting and managing minting NFT collections and tokens
 */
export class CoinClient {
  aptosClient: AptosClient;

  transactionBuilder: TransactionBuilderABI;

  /**
   * Creates new CoinClient instance
   * @param aptosClient AptosClient instance
   */
  constructor(aptosClient: AptosClient) {
    this.aptosClient = aptosClient;
    this.transactionBuilder = new TransactionBuilderABI(TOKEN_ABIS.map((abi) => new HexString(abi).toUint8Array()));
  }

  /**
   * Generate, submit, and wait for a transaction to transfer AptosCoin from
   * one account to another.
   *
   * If the transaction is submitted successfully, it returns the response
   * from the API indicating that the transaction was submitted.
   *
   * @param from Account sending the coins
   * @param from Account to receive the coins
   * @param amount Number of coins to transfer
   * @param extraArgs Extra args for building the transaction or configuring how
   * the client should submit and wait for the transaction.
   * @returns Promise that resolves to the response from the API
   */
  async transferCoins(
    from: AptosAccount,
    to: AptosAccount,
    amount: number | bigint,
    extraArgs?: {
      // The coin type to use, defaults to 0x1::aptos_coin::AptosCoin
      coinType?: string;
      maxGasAmount?: BCS.Uint64;
      gasUnitPrice?: BCS.Uint64;
      expireTimestamp?: BCS.Uint64;
      // If true, this function will throw if the transaction is not committed succesfully.
      checkSuccess?: boolean;
    },
  ): Promise<Gen.Transaction> {
    const coinToTransfer =
      extraArgs?.coinType != null ? new TypeTagParser(extraArgs?.coinType).parseTypeTag() : APTOS_COIN;
    // TODO: Do the same thing token client does with its ABIs.
    // TODO: TOKEN_ABIS (and soon the coin equivalent) seems super brittle, do we have CI
    // for this that includes instructions on how to regenerate these values if the
    // token module interface changes?
    const payload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        // Fully qualified module name, `AccountAddress::ModuleName`
        "0x1::coin",
        // Module function
        "transfer",
        // The coin type to transfer
        [coinToTransfer],
        // Arguments for function `transfer`: receiver account address and amount to transfer
        [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(to.address())), BCS.bcsSerializeUint64(amount)],
      ),
    );
    return this.aptosClient.generateSendWaitForTransaction(from, payload, extraArgs);
  }

  /**
   * Generate, submit, and wait for a transaction to transfer AptosCoin from
   * one account to another.
   *
   * If the transaction is submitted successfully, it returns the response
   * from the API indicating that the transaction was submitted.
   *
   * @param account Account that you want to check the balance of.
   * @param extraArgs Extra args for checking the balance.
   * @returns Promise that resolves to the balance as a bigint.
   */
  async checkBalance(
    account: AptosAccount,
    extraArgs?: {
      // The coin type to use, defaults to 0x1::aptos_coin::AptosCoin
      coinType?: string;
    },
  ): Promise<bigint> {
    const coinType = extraArgs?.coinType ?? APTOS_COIN_RAW;
    const typeTag = `0x1::coin::CoinStore<${coinType}>`;
    const resources = await this.aptosClient.getAccountResources(account.address());
    const accountResource = resources.find((r) => r.type === typeTag);
    return BigInt((accountResource!.data as any).coin.value);
  }
}
