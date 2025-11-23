import Remote from "../ssh/Remote";
import { ConfigDunning, ConfigTransfer } from "@utils/types/internal/config";
import {
  PayloadDunning,
  PayloadPayment,
  PayloadTransfer,
} from "@utils/types/external/payload";
import Logger from "../common/Logger";
import CommonUtil from "@class/common/CommonUtil";
import DateUtil from "@class/common/DateUtil";
import names from "@constants/names";
import Pod from "@class/ssh/Pod";
import Couchbase from "@class/wrapper/Couchbase";

/**
 * Performs all the task on kafka pod.
 * @class
 */
class Kafka {
  private podName?: string;

  private async checkPodname() {
    if (!this.podName) {
      const podName = (await Pod.getPodKafka())[0] || "";
      this.podName = podName;
    }
  }

  private namespace(): string {
    const env = Remote.getEnv();
    switch (env) {
      case "stg1":
        return names.NAMESPACE_STG1;

      case "stg2":
        return names.NAMESPACE_STG2;

      case "stg3":
        return names.NAMESPACE_STG3;

      case "prod":
        return names.NAMESPACE_PROD;

      default:
        return "";
    }
  }

  public async runDunning(config: ConfigDunning): Promise<void> {
    await this.checkPodname();

    const oldestInvoice = await Couchbase.getOldestInvoice(config.accountId);
    const dunningEvents = this.getDunningEvent(oldestInvoice, config);

    for (const event of dunningEvents) {
      Logger.task(`trying to run ${event.event} against ${config.accountId}`);
      const eventString = JSON.stringify(event).replace(/"/g, '\\"'); // Escape double quotes in the event JSON
      const cmd = [
        `kubectl exec`,
        `${this.podName}`,
        `-- sh -c "unset KAFKA_JMX_OPTS`,
        `&&`,
        `echo '${eventString}'`,
        `|`,
        `kafka-console-producer.sh`,
        `--topic BS_SCHEDULER_BILLCOLLECTION`,
        `--broker-list kafka-kafka-cl-0:9092"`,
      ].join(" ");
      await Remote.execRemote(cmd);
    }
  }

  private getDunningEvent(
    invoice: string,
    config: ConfigDunning
  ): PayloadDunning[] {
    const dunningEvents: PayloadDunning[] = [];
    const template: PayloadDunning = {
      event: null,
      billingAccId: config.accountId,
      invoiceId: invoice,
    };

    if (config.successive) {
      for (let i = 0; i < config.event; i++) {
        const dunning: PayloadDunning = { ...template };
        dunning.event = `EVENT${i + 1}`;
        dunningEvents.push(dunning);
      }
    } else {
      const dunning: PayloadDunning = { ...template };
      dunning.event = `EVENT${config.event}`;
      dunningEvents.push(dunning);
    }

    return dunningEvents;
  }

  public async execTransfer(config: ConfigTransfer): Promise<void> {
    await this.checkPodname();

    Logger.task(`trying to transfer ${config.amount} to ${config.accountId}`);

    const transferInfo = this.getTransferInfo(config);
    const transferString = JSON.stringify(transferInfo).replace(/"/g, '\\"'); // Escape double quotes in the event JSON
    console.log(transferInfo);

    const cmd = [
      `kubectl exec`,
      `${this.podName}`,
      `-- sh -c "unset KAFKA_JMX_OPTS`,
      `&&`,
      `echo '${transferString}'`,
      `|`,
      `kafka-console-producer.sh`,
      `--topic PaymentUpdt`,
      `--broker-list localhost:9092"`,
    ].join(" ");
    await Remote.execRemote(cmd);
  }

  public async registerPaymentOld(config: ConfigTransfer): Promise<void> {
    await this.checkPodname();

    Logger.task(`trying to register payment history to ${config.accountId}`);

    const paymentInfo = this.getPaymentInfo(config);
    console.log(paymentInfo);

    const cmd = [
      `kubectl exec ${this.podName}`,
      `-n ${this.namespace()}`,
      `-- curl -k -u elastic:'R@ku!)@!2#'`,
      `-H 'Content-Type: application/json'`,
      `-d '${JSON.stringify(paymentInfo)}'`,
      `'http://opensource-mno-elasticsearch-client-service.${this.namespace()}.svc.cluster.local:9200/payment-history/_doc'`,
    ].join(" ");

    await Remote.execRemote(cmd).then((result) => {
      if (typeof result === "string") {
        const execResult = JSON.parse(result);
        if (execResult.result === "created") {
          Logger.success(
            `successfully registered payment history to ${config.accountId}`
          );
          console.log(execResult);
        } else {
          Logger.error(
            `failed to register payment history to ${config.accountId}`
          );
          console.log(execResult);
        }
      }
    });
  }

  private getTransferInfo(config: ConfigTransfer): PayloadTransfer {
    const transId = CommonUtil.uuid();
    const paymentTime = DateUtil.toYYYYMMDDHHmmss(config.paymentDate);
    return {
      bssBillingId: config.accountId,
      bssTransactionId: transId,
      bssAccessTime: paymentTime,
      bkPaymentTransactionId: transId,
      bkPaymentDateandTime: paymentTime,
      bkPaymentAmount: config.amount.toString(),
      bssDescription: "Payment",
      bssGLCode: "GL200",
      bssPaymentMode: config.mode,
    };
  }

  private getPaymentInfo(config: ConfigTransfer): PayloadPayment {
    const transId = CommonUtil.uuid();
    const paymentTime = DateUtil.toYYYYMMDDHHmmss(config.paymentDate);
    return {
      accountId: config.accountId,
      ktab: "6002::PAYMENT_HISTORY",
      paymentDueDate: paymentTime,
      type: "Payment",
      paymentDetails: config.mode,
      paymentProcessedDate: paymentTime,
      internalTransactionId: transId,
      externalTransactionId: transId,
      paymentMethod: config.mode,
      paymentOrigin: "BILLING",
      paymentStatus: "SUCCESS",
      requestedAmount: config.amount,
      receivedAmount: config.amount,
      transactionDate: paymentTime,
      etInfoBankCode: "0700-",
      etInfoBankAccountNumber: "hXRCdsr0mR0is39HpXzXJw==",
      etInfoBranchCode: "700-",
      etInfoName: "IgQzevAtk5ilY4wqbKt1ww==",
      createdDtm: paymentTime,
      accountType: "TYPE1",
      bankNo: "0700",
      branchNo: "700",
      customerNo:
        "WHvjj05rySEBuREUnOJLBoNnEkzUI9hyN2iElL/jyMSw4P4SSeehb/HKMaH9/Lsm",
    };
  }

  public async execWriteoff(): Promise<void> {
    await this.checkPodname();

    Logger.task(`trying to invoke depriciation scheduler`);

    const writeoffCommand = { initiateDepreciation: true };
    const writeoffString = JSON.stringify(writeoffCommand).replace(/"/g, '\\"'); // Escape double quotes in the event JSON

    const cmd = [
      `kubectl exec`,
      `${this.podName}`,
      `-- sh -c "unset KAFKA_JMX_OPTS`,
      `&&`,
      `echo '${writeoffString}'`,
      `|`,
      `kafka-console-producer.sh`,
      `--topic BS_SCHEDULER_BILLCOLLECTION_DEPRECIATION`,
      `--broker-list localhost:9092"`,
    ].join(" ");
    console.log(cmd);
    await Remote.execRemote(cmd);
  }

  public async isValidForWriteOff(
    billingId: string,
    invoiceId: string
  ): Promise<boolean> {
    const dunningState = await Couchbase.getDunningState(billingId, invoiceId);
    if (dunningState !== "CANCELLED") {
      `oldest invoice ${invoiceId} is not at canceled state, execute dunning event 8 then try again!`;
      return false;
    } else {
      return true;
    }
  }
}

export default new Kafka();

