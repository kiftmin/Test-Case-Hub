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
import { Loader2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

interface SignOffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  userRole: string | null;
  signOffData: any;
  onSignOff: (role: string, note?: string) => Promise<void>;
  isPending: boolean;
}

export function SignOffDialog({ open, onOpenChange, project, userRole, signOffData, onSignOff, isPending }: SignOffDialogProps) {
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

  const testLeadSigned = !!signOffData?.testLead;
  const businessOwnerSigned = !!signOffData?.businessOwner;

  const currentUserCanSign =
    (userRole === "TEST_LEAD" && !testLeadSigned) ||
    (userRole === "BUSINESS_OWNER" && !businessOwnerSigned);

  const signingRole =
    userRole === "TEST_LEAD" ? "Test Lead" :
    userRole === "BUSINESS_OWNER" ? "Business Owner" : null;

  const isFullySigned = testLeadSigned && businessOwnerSigned;

  const handleSign = () => {
    const role = userRole === "TEST_LEAD" ? "TEST_LEAD" : "BUSINESS_OWNER";
    onSignOff(role);
  };

  const SignatureStatus = ({ label, signed, signedBy, signedAt }: { label: string; signed: boolean; signedBy?: string; signedAt?: string }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${signed ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
      {signed ? (
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
      ) : (
        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
      )}
      <div className="flex-1">
        <span className="font-medium text-slate-700">{label}:</span>{" "}
        {signed ? (
          <span className="text-green-700">
            Signed by {signedBy} on {format(new Date(signedAt!), "d MMM yyyy, HH:mm")}
          </span>
        ) : (
          <span className="text-slate-400">Pending signature</span>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Project Sign-off: {project.name}</DialogTitle>
          <DialogDescription>
            Both Test Lead and Business Owner must sign to complete the sign-off.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mb-4">
          <SignatureStatus
            label="Test Lead"
            signed={testLeadSigned}
            signedBy={signOffData?.testLead?.signedBy}
            signedAt={signOffData?.testLead?.signedAt}
          />
          <SignatureStatus
            label="Business Owner"
            signed={businessOwnerSigned}
            signedBy={signOffData?.businessOwner?.signedBy}
            signedAt={signOffData?.businessOwner?.signedAt}
          />
        </div>

        {currentUserCanSign && (
          <>
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-slate-800 mb-3">
                You are signing as <span className="text-blue-600">{signingRole}</span>. Please confirm:
              </p>

              <div className="space-y-3">
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
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-md flex gap-3 text-amber-800 text-xs mt-4">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <div>
                Sign-off will be based on the last completed test run. Any failed use cases will be listed as open issues (workarounds).
              </div>
            </div>
          </>
        )}

        {isFullySigned && (
          <div className="bg-green-50 border border-green-200 p-3 rounded-md flex gap-3 text-green-800 text-sm mt-4">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div className="font-medium">Project is fully signed off.</div>
          </div>
        )}

        {!currentUserCanSign && !isFullySigned && (
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-md text-sm text-slate-600 mt-4">
            {userRole !== "TEST_LEAD" && userRole !== "BUSINESS_OWNER"
              ? "Only the Test Lead and Business Owner can sign off this project."
              : "You have already signed off this project."}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          {currentUserCanSign && (
            <Button
              onClick={handleSign}
              disabled={!allConfirmed || isPending}
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sign as {signingRole}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
