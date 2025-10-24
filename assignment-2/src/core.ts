/* 輸入 Type */
export type BillInput = {
  date: string;
  location: string;
  tipPercentage: number;
  items: BillItem[];
  persons?: string[]; // 可選字段，用於指定參與分帳的人員
};

type BillItem = SharedBillItem | PersonalBillItem;

type CommonBillItem = {
  price: number;
  name: string;
};

type SharedBillItem = CommonBillItem & {
  isShared: true;
};

type PersonalBillItem = CommonBillItem & {
  isShared: false;
  person: string;
};

/* 輸出 Type */
export type BillOutput = {
  date: string;
  location: string;
  subTotal: number;
  tip: number;
  totalAmount: number;
  items: PersonItem[];
};

type PersonItem = {
  name: string;
  amount: number;
};

/* 核心函數 */
export function splitBill(input: BillInput): BillOutput {
  let date = formatDate(input.date);
  let location = input.location;
  let subTotal = calculateSubTotal(input.items);
  let tip = calculateTip(subTotal, input.tipPercentage);
  let totalAmount = subTotal + tip;
  let items = calculateItems(input.items, input.tipPercentage, input.persons);
  adjustAmount(totalAmount, items);
  return {
    date,
    location,
    subTotal,
    tip,
    totalAmount,
    items,
  };
}

export function formatDate(date: string): string {
  // input format: YYYY-MM-DD, e.g. "2024-03-21"
  // output format: YYYY年M月D日, e.g. "2024年3月21日"
  const [year, month, day] = date.split("-");
  return `${year}年${parseInt(month)}月${parseInt(day)}日`;
}

function calculateSubTotal(items: BillItem[]): number {
  // sum up all the price of the items
  return items.reduce((total, item) => total + item.price, 0);
}

export function calculateTip(subTotal: number, tipPercentage: number): number {
  // output round to closest 10 cents, e.g. 12.34 -> 12.3
  const tipAmount = (subTotal * tipPercentage) / 100;
  return Math.round(tipAmount * 10) / 10;
}

function scanPersons(items: BillItem[]): string[] {
  // scan the persons in the items
  const persons = new Set<string>();

  items.forEach((item) => {
    if (!item.isShared && "person" in item) {
      persons.add(item.person);
    }
  });

  return Array.from(persons).sort();
}

function calculateItems(
  items: BillItem[],
  tipPercentage: number,
  persons?: string[]
): PersonItem[] {
  let names = persons && persons.length > 0 ? persons : scanPersons(items);
  let personsCount = names.length;
  return names.map((name) => ({
    name,
    amount: calculatePersonAmount({
      items,
      tipPercentage,
      name,
      persons: personsCount,
    }),
  }));
}

function calculatePersonAmount(input: {
  items: BillItem[];
  tipPercentage: number;
  name: string;
  persons: number;
}): number {
  // for shared items, split the price evenly
  // for personal items, do not split the price
  // return the amount for the person
  const { items, tipPercentage, name, persons } = input;

  let personalAmount = 0;
  let sharedAmount = 0;

  items.forEach((item) => {
    if (item.isShared) {
      sharedAmount += item.price;
    } else if ("person" in item && item.person === name) {
      personalAmount += item.price;
    }
  });

  // Calculate person's share of shared items
  const sharedPerPerson = persons > 0 ? sharedAmount / persons : 0;

  // Calculate subtotal for this person
  const personSubTotal = personalAmount + sharedPerPerson;

  // Add tip proportionally
  const personTip = (personSubTotal * tipPercentage) / 100;

  // Round to nearest 10 cents
  return Math.round((personSubTotal + personTip) * 10) / 10;
}

function adjustAmount(totalAmount: number, items: PersonItem[]): void {
  // adjust the personal amount to match the total amount
  if (items.length === 0) return;

  const currentTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const difference = Math.round((totalAmount - currentTotal) * 10) / 10;

  if (Math.abs(difference) > 0.01) {
    // Add the difference to the first person to ensure total matches
    items[0].amount = Math.round((items[0].amount + difference) * 10) / 10;
  }
}
