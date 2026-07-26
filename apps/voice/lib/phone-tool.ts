import {
  openBlinkit,
  placeCodOrder,
  prepareCodCheckout,
  prepareGrocery,
  readPhoneStatus,
} from './appium';

export type PhoneActionArguments = {
  action?:
    | 'phone_status'
    | 'open_blinkit'
    | 'prepare_grocery'
    | 'prepare_cod_checkout'
    | 'confirm_cod_order';
  expectedFingerprint?: string;
  request?: string;
  searchQuery?: string;
};

export async function executePhoneAction(arguments_: PhoneActionArguments) {
  switch (arguments_.action) {
    case 'phone_status':
      return { ok: true, result: await readPhoneStatus() };
    case 'open_blinkit':
      return { ok: true, result: await openBlinkit() };
    case 'prepare_grocery':
      return prepareGrocery(arguments_.request ?? '', arguments_.searchQuery);
    case 'prepare_cod_checkout':
      return prepareCodCheckout();
    case 'confirm_cod_order':
      return placeCodOrder(arguments_.expectedFingerprint ?? '');
    default:
      return {
        ok: false,
        status: 'unsupported_action',
        message: 'The requested phone action is not supported.',
      };
  }
}
