export interface RefuelRecord {
  id: string;
  reservationNumber: string;
  rego: string;
  addedToRCM: boolean;
  amount: number;
  refuelledBy: string;
  createdAt: Date;
}

export interface Staff {
  id: string;
  name: string;
}

export interface RefuelList {
  date: Date;
  records: RefuelRecord[];
  checkedBy?: string;
}