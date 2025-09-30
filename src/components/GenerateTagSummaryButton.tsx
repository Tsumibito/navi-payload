'use client';

import type { ComponentProps } from 'react';

import { GenerateSummaryButton } from './GenerateSummaryButton';

export function GenerateTagSummaryButton(props: ComponentProps<typeof GenerateSummaryButton>) {
  return <GenerateSummaryButton kind="tag" {...props} />;
}

export default GenerateTagSummaryButton;
