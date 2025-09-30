'use client';

import type { ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

export default function S3ClientUploadHandlerStub({ children }: Props) {
  return <>{children ?? null}</>;
}
