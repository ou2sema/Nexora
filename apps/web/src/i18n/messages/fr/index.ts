import type { MessageKey } from '../en';
import { admin } from './admin';
import { auth } from './auth';
import { catalog } from './catalog';
import { common } from './common';
import { counterSale } from './counter-sale';
import { customers } from './customers';
import { dashboard } from './dashboard';
import { devices } from './devices';
import { errors } from './errors';
import { guide } from './guide';
import { invoices } from './invoices';
import { layout } from './layout';
import { nav } from './nav';
import { organizations } from './organizations';
import { purchasing } from './purchasing';
import { returns } from './returns';
import { sales } from './sales';
import { scanning } from './scanning';
import { stock } from './stock';
import { suppliers } from './suppliers';
import { team } from './team';
import { warehouses } from './warehouses';

export const frMessages: Record<MessageKey, string> = {
  ...common,
  ...nav,
  ...layout,
  ...auth,
  ...errors,
  ...organizations,
  ...dashboard,
  ...catalog,
  ...stock,
  ...devices,
  ...scanning,
  ...suppliers,
  ...purchasing,
  ...sales,
  ...counterSale,
  ...invoices,
  ...customers,
  ...returns,
  ...team,
  ...admin,
  ...warehouses,
  ...guide,
};
