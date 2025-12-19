'use client';

import { Check, Loader2 } from 'lucide-react';

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed';
}

interface ProgressStepperProps {
  steps: Step[];
}

export default function ProgressStepper({ steps }: ProgressStepperProps) {
  return (
    <div className="w-full">
      <div className="space-y-6">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-4">
            {/* Step Indicator */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300
                  ${
                    step.status === 'completed'
                      ? 'border-teal-600 bg-teal-600'
                      : step.status === 'processing'
                      ? 'border-teal-600 bg-teal-50'
                      : 'border-slate-300 bg-white'
                  }
                `}
              >
                {step.status === 'completed' ? (
                  <Check className="h-5 w-5 text-white" />
                ) : step.status === 'processing' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                ) : (
                  <span className="text-sm font-medium text-slate-400">{index + 1}</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`
                    mt-2 h-12 w-0.5 transition-colors duration-300
                    ${step.status === 'completed' ? 'bg-teal-600' : 'bg-slate-200'}
                  `}
                />
              )}
            </div>

            {/* Step Content */}
            <div className="flex-1 pt-1">
              <p
                className={`
                  text-base font-medium transition-colors
                  ${
                    step.status === 'completed'
                      ? 'text-teal-700'
                      : step.status === 'processing'
                      ? 'text-teal-600'
                      : 'text-slate-500'
                  }
                `}
              >
                {step.label}
              </p>
              {step.status === 'processing' && (
                <p className="mt-1 text-sm text-slate-500">This may take a few moments...</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

