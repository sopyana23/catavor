import React from 'react';
import {
  SharedAdSenseUnit,
  type SharedAdSenseUnitProps,
} from '../../../shared/monetization/SharedAdSenseUnit';

export type AdSenseUnitProps = Omit<SharedAdSenseUnitProps, 'device'>;

export const AdSenseUnit: React.FC<AdSenseUnitProps> = (props) => (
  <SharedAdSenseUnit {...props} device="desktop" />
);

export default AdSenseUnit;
