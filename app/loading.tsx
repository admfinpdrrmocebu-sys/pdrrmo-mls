import React from 'react';
import { MLSLoader } from '@/components/loader';

export default function Loading() {
  return <MLSLoader size="fullscreen" label="PDRRMO MLS" sublabel="SYNCHRONIZING TELEMETRY..." />;
}
