import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/card"; // Wait, Dialog is usually in ui/dialog
import { Button } from "@/components/ui/button";
import { Smartphone, Share2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

// Since I don't have a Dialog component ready, I'll use a Popover or a simple modal logic
// Actually, I'll check if Dialog exists.

export function MobileShare() {
  const [copied, setCopied] = useState(false);
  const currentUrl = window.location.href;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center p-6 space-y-6">
      <div className="p-4 bg-white rounded-xl shadow-inner border">
        <QRCodeSVG value={currentUrl} size={180} level="H" includeMargin />
      </div>
      
      <div className="text-center space-y-2">
        <h3 className="font-bold text-lg">Switch to Mobile</h3>
        <p className="text-sm text-muted-foreground">
          Scan this code to continue testing on your mobile device. Perfect for capturing photos of hardware or on-site issues.
        </p>
      </div>

      <div className="flex w-full gap-2">
        <Button variant="outline" className="flex-1" onClick={handleCopy}>
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          Copy Link
        </Button>
      </div>
    </div>
  );
}
