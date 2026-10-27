export interface VehicleRoiInput {
  acquisitionCost: number;
  revenue: number;
  maintenanceCost: number;
  fuelCost: number;
}

export interface VehicleRoiResult extends VehicleRoiInput {
  profit: number;
  roiPercent: number;
}

export function calculateVehicleRoi({
  acquisitionCost,
  revenue,
  maintenanceCost,
  fuelCost,
}: VehicleRoiInput): VehicleRoiResult {
  const profit = revenue - maintenanceCost - fuelCost;

  return {
    acquisitionCost,
    revenue,
    maintenanceCost,
    fuelCost,
    profit,
    roiPercent:
      acquisitionCost > 0 && revenue > 0
        ? Math.round((profit / acquisitionCost) * 100)
        : 0,
  };
}
