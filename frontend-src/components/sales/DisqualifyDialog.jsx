import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle } from 'lucide-react';

const DISQUALIFICATION_REASONS = [
  { value: 'no_strong_need', label: 'No strong need' },
  { value: 'no_low_budget', label: 'No/low Budget' },
  { value: 'bad_timing', label: 'Bad Timing' },
  { value: 'low_fit', label: 'Low fit' },
  { value: 'low_perceived_value', label: 'Low perceived value' },
  { value: 'chose_competitor', label: 'Chose competitor' },
  { value: 'no_reply', label: 'Did not engage/no reply' },
  { value: 'other', label: 'Other' },
];

export default function DisqualifyDialog({ open, onOpenChange, onConfirm, leadName }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm(reason, notes);
    setReason('');
    setNotes('');
  };

  const handleClose = () => {
    setReason('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="text-red-400" size={24} />
            Disqualify Lead
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-gray-400 mb-4">
            Why are you disqualifying <span className="text-white font-medium">{leadName}</span>?
          </p>

          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2">
            {DISQUALIFICATION_REASONS.map((r) => (
              <div 
                key={r.value}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer
                  ${reason === r.value 
                    ? 'border-red-400/50 bg-red-400/10' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                onClick={() => setReason(r.value)}
              >
                <RadioGroupItem value={r.value} id={r.value} className="border-white/30" />
                <Label htmlFor={r.value} className="text-white cursor-pointer flex-1">
                  {r.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {reason === 'other' && (
            <div className="mt-4">
              <Label className="text-gray-400">Please specify (max 200 characters)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                className="mt-1.5 bg-black/30 border-white/10 text-white resize-none"
                placeholder="Enter reason..."
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1 text-right">{notes.length}/200</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-white/10 text-white hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!reason || (reason === 'other' && !notes)}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            Disqualify Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}