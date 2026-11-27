import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/components/session";
import type { useChainRun } from "@/components/tx-dialog";
import artifacts from "@/lib/abi/core.json";
import { prepareBuyer } from "@/lib/api";
import { friendlyChainError } from "@/lib/chain-errors";
import { formatAmount } from "@/lib/utils";

type ChainRunner = ReturnType<typeof useChainRun>;

function FaucetCoinIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9.5" cy="9.5" r="5.5" />
      <path d="M9.5 7.5v4" />
      <path d="M15.8 10.2a5.5 5.5 0 1 1-5.6 5.6" />
    </svg>
  );
}

/** Shared testnet DxDAI faucet claim trigger button for navbar or mobile drawer. */
export function FaucetClaimButton({
  chain,
  mobile = false,
}: {
  chain: ChainRunner;
  mobile?: boolean;
}) {
  const { me, config, sendUserCall, refreshBalance } = useSession();
  const [claiming, setClaiming] = useState(false);

  const claim = useCallback(async () => {
    if (!config?.demoBank) {
      toast.error("Dev mode is off.");
      return;
    }
    setClaiming(true);
    try {
      await chain.run({
        title: "Claim test coins",
        labels: ["Check claim availability", "Confirm in your wallet", "Add coins to your balance"],
        doneLabel: "Close",
        task: async (advance) => {
          const prep = await prepareBuyer();
          if (prep.demo?.dripped) {
            await refreshBalance(true);
            return `You already claimed ${formatAmount(prep.demo.cents, "DxDAI")}.`;
          }
          advance(1);
          await sendUserCall({
            to: config.demoBank as `0x${string}`,
            abi: artifacts.DemoBank.abi,
            functionName: "claim",
            args: [],
          });
          advance(2);
          await refreshBalance(true);
          return "100 DxDAI was added to your wallet.";
        },
        retry: () => void claim(),
      });
    } catch (e) {
      toast.error(friendlyChainError(e));
    } finally {
      setClaiming(false);
    }
  }, [chain, config?.demoBank, refreshBalance, sendUserCall]);

  if (!me || !config?.devMode) return null;

  return (
    <button
      type="button"
      className={mobile ? "btn-claim-mini mt-2 w-full justify-center" : "btn-claim-mini"}
      title={mobile ? undefined : "Claim 100 Testnet DxDAI"}
      disabled={claiming}
      onClick={() => void claim()}
    >
      <FaucetCoinIcon />
      <span>{claiming ? "Claiming..." : "Claim 100 DxDAI"}</span>
    </button>
  );
}
