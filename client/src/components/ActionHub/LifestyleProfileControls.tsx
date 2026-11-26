import type {
  CommuteMode,
  HeatingCookingFuel,
  HousingType,
  LifestyleProfile,
} from '../../utils/smogImpactEngine';

interface LifestyleProfileControlsProps {
  lifestyle: LifestyleProfile;
  onChangeLifestyle: (next: LifestyleProfile) => void;
}

export function LifestyleProfileControls({
  lifestyle,
  onChangeLifestyle,
}: LifestyleProfileControlsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div>
        <label
          htmlFor="lifestyle-commute"
          className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Primary Commute
        </label>
        <select
          id="lifestyle-commute"
          value={lifestyle.commuteMode}
          onChange={(e) =>
            onChangeLifestyle({ ...lifestyle, commuteMode: e.target.value as CommuteMode })
          }
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="solo_car">Solo Petrol / Diesel Car</option>
          <option value="motorbike">Motorbike / Scooter</option>
          <option value="carpool">Shared Carpool</option>
          <option value="public_transit">Metro / Bus Transit</option>
          <option value="bike_walk">Bike / Walk</option>
          <option value="remote">Work From Home</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="lifestyle-heating"
          className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Heating &amp; Cooking Fuel
        </label>
        <select
          id="lifestyle-heating"
          value={lifestyle.heatingCookingFuel}
          onChange={(e) =>
            onChangeLifestyle({
              ...lifestyle,
              heatingCookingFuel: e.target.value as HeatingCookingFuel,
            })
          }
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="gas_lpg">Gas Stove / LPG</option>
          <option value="wood_biomass">Wood / Biomass / Coal</option>
          <option value="diesel_backup">Diesel Generator / Heater</option>
          <option value="electric_induction">Electric / Induction</option>
          <option value="heat_pump">Clean Electric Heat Pump</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="lifestyle-housing"
          className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Home Type
        </label>
        <select
          id="lifestyle-housing"
          value={lifestyle.housingType}
          onChange={(e) =>
            onChangeLifestyle({ ...lifestyle, housingType: e.target.value as HousingType })
          }
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="older_drafty">Older / Drafty Home</option>
          <option value="apartment_highrise">Urban Apartment</option>
          <option value="suburban_home">Detached House</option>
          <option value="shared_flat">Shared Flat / Dorm</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="lifestyle-household-size"
          className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Household Members
        </label>
        <input
          id="lifestyle-household-size"
          type="number"
          min={1}
          max={8}
          value={lifestyle.householdSize}
          onChange={(e) =>
            onChangeLifestyle({
              ...lifestyle,
              householdSize: Math.min(8, Math.max(1, Number(e.target.value) || 1)),
            })
          }
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>
    </div>
  );
}
