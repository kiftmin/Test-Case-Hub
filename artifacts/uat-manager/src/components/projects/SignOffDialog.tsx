import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";

interface SignOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  onSignOff: (confirmations: any) => Promise<void>;
  isPending: boolean;
}

export function SignOffDialog({ open, onOpenChange, project, onSignOff, isPending }: SignOffDialogProps) {
  const [confirmations, setConfirmations] = useState({
    allPlannedTestsExecuted: false,
    criticalDefectsResolved: false,
    stakeholdersVerified: false,
    meetsRequirements: false,
    deploymentAware: false,
  });

  const allConfirmed = Object.values(confirmations).every(v => v === true);

  const handleConfirmChange = (key: keyof typeof confirmations) => {
    setConfirmations(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Project Sign-off: {project.name}</DialogTitle>
          <DialogDescription>
            Please confirm the following items to sign off the project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start space-x-3 space-y-0">
            <Checkbox
              id="planned-tests"
              checked={confirmations.allPlannedTestsExecuted}
              onCheckedChange={() => handleConfirmChange("allPlannedTestsExecuted")}
            />
            <Label htmlFor="planned-tests" className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              All planned tests were executed.
            </Label>
          </div>

          <div className="flex items-start space-x-3 space-y-0">
            <Checkbox
              id="critical-defects"
              checked={confirmations.criticalDefectsResolved}
              onCheckedChange={() => handleConfirmChange("criticalDefectsResolved")}
            />
            <Label htmlFor="critical-defects" className="text-sm font-normal cursor-pointer leading-none">
              All critical (P0/P1) defects are resolved.
            </Label>
          </div>

          <div className="flex items-start space-x-3 space-y-0">
            <Checkbox
              id="stakeholders"
              checked={confirmations.stakeholdersVerified}
              onCheckedChange={() => handleConfirmChange("stakeholdersVerified")}
            />
            <Label htmlFor="stakeholders" className="text-sm font-normal cursor-pointer leading-none">
              Business stakeholders have verified the results.
            </Label>
          </div>

          <div className="flex items-start space-x-3 space-y-0">
            <Checkbox
              id="requirements"
              checked={confirmations.meetsRequirements}
              onCheckedChange={() => handleConfirmChange("meetsRequirements")}
            />
            <Label htmlFor="requirements" className="text-sm font-normal cursor-pointer leading-none">
              The system meets defined business requirements.
            </Label>
          </div>

          <div className="flex items-start space-x-3 space-y-0">
            <Checkbox
              id="deployment"
              checked={confirmations.deploymentAware}
              onCheckedChange={() => handleConfirmChange("deploymentAware")}
            />
            <Label htmlFor="deployment" className="text-sm font-normal cursor-pointer leading-none">
              The deployment team is aware of the approval.
            </Label>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-3 rounded-md flex gap-3 text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div>
            Sign-off will be based on the last completed test run. Any failed use cases will be listed as open issues (workarounds).
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => onSignOff(confirmations)}
            disabled={!allConfirmed || isPending}
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirm Sign-off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
