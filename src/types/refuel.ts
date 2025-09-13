export interface RefuelRecord {
  id: string;
  reservationNumber: string;
  rego: string;
  addedToRCM: boolean;
  amount: number;
  refuelledBy: string;
  createdAt: Date;
  receiptPhotoUrl?: string;
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

export interface RefuelFormData {
  rego: string;
  amount: string;
  refuelledBy: string;
  reservationNumber: string;
  receiptPhotoUrl?: string;
}

export interface RefuelRecordUpdate {
  rego?: string;
  amount?: number;
  refuelledBy?: string;
  reservationNumber?: string;
  addedToRCM?: boolean;
  receiptPhotoUrl?: string;
  createdAt?: Date;
}