"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { STEPS, emptyFormData } from "./constants";
import type { ProfileFormData } from "./types";
import { StepIndicator } from "./StepIndicator";

import { BusinessStep } from "./steps/BusinessStep";
import { TradeStep } from "./steps/TradeStep";
import { ServicesStep } from "./steps/ServicesStep";
import { PricingStep } from "./steps/PricingStep";
import { LicensesStep } from "./steps/LicensesStep";
import { HoursStep } from "./steps/HoursStep";
import { LocationStep } from "./steps/LocationStep";
import { BookingStep } from "./steps/BookingStep";
import { CancellationStep } from "./steps/CancellationStep";
import { PublishStep } from "./steps/PublishStep";

export default function ProfileWizard() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ProfileFormData>(emptyFormData);
  const [done, setDone] = useState(false);

  const currentKey = STEPS[step].key;
  const isPublishStep = currentKey === "publish";

  // Trades picked in step 3, used to populate the per-service trade dropdown.
  const selectedTrades = [
    formData.trade.primaryTrade,
    ...formData.trade.additionalTrades,
  ].filter(Boolean);

  const goNext = () => {
    if (step === STEPS.length - 1) {
      setDone(true);
    } else {
      setStep((s) => s + 1);
    }
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const renderStep = () => {
    switch (currentKey) {
      case "business":
        return (
          <BusinessStep
            data={formData.business}
            update={(value) => setFormData((prev) => ({ ...prev, business: value }))}
          />
        );
      case "location":
        return (
          <LocationStep
            data={formData.location}
            update={(value) => setFormData((prev) => ({ ...prev, location: value }))}
          />
        );
      case "trade":
        return (
          <TradeStep
            data={formData.trade}
            update={(value) => setFormData((prev) => ({ ...prev, trade: value }))}
          />
        );
      case "services":
        return (
          <ServicesStep
            data={formData.services}
            update={(value) => setFormData((prev) => ({ ...prev, services: value }))}
            availableTrades={selectedTrades}
          />
        );
      case "licenses":
        return (
          <LicensesStep
            data={formData.licenses}
            update={(value) => setFormData((prev) => ({ ...prev, licenses: value }))}
            defaultState={formData.location.state}
          />
        );
      case "pricing":
        return (
          <PricingStep
            data={formData.pricing}
            update={(value) => setFormData((prev) => ({ ...prev, pricing: value }))}
          />
        );
      case "hours":
        return (
          <HoursStep
            data={formData.hours}
            update={(value) => setFormData((prev) => ({ ...prev, hours: value }))}
          />
        );
      case "booking":
        return (
          <BookingStep
            data={formData.booking}
            update={(value) => setFormData((prev) => ({ ...prev, booking: value }))}
          />
        );
      case "cancellation":
        return (
          <CancellationStep
            data={formData.cancellation}
            update={(value) => setFormData((prev) => ({ ...prev, cancellation: value }))}
          />
        );
      case "publish":
        return (
          <PublishStep
            formData={formData}
            onPublish={() => {
              setFormData((prev) => ({ ...prev, publish: { published: true } }));
              setDone(true);
            }}
            onSaveDraft={() => setDone(true)}
            onJumpToStep={(key) => {
              const idx = STEPS.findIndex((s) => s.key === key);
              if (idx >= 0) setStep(idx);
            }}
          />
        );
      default:
        return null;
    }
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <Card>
          <CardHeader className="items-center text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Profile saved</CardTitle>
            <CardDescription>
              Everything you filled in has been saved. You can come back and complete the rest
              anytime — nothing here was required.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setDone(false);
                setStep(0);
              }}
            >
              Review profile
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <StepIndicator current={step} onJump={setStep} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{STEPS[step].label}</CardTitle>
              <CardDescription>
                Step {step + 1} of {STEPS.length}
              </CardDescription>
            </div>
            {!isPublishStep && <Badge variant="secondary">Optional</Badge>}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">{renderStep()}</CardContent>
        <Separator />
        <CardFooter className="flex justify-between pt-4">
          <Button variant="ghost" onClick={goBack} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          {!isPublishStep && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDone(true)}>
                Save & exit
              </Button>
              <Button onClick={goNext}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
