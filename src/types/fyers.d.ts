export interface FyersMarketStatus {
  marketStatus: {
    status: string;
    description: string;
  }[];
}

export interface FyersConfig {
  appId: string;
  appSecret: string;
  redirectUrl: string;
}

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface UserProfile {
  name: string;
  email: string;
  mobile: string;
  pan: string;
  address: string;
  city: string;
  state: string;
  country: string;
  pin: string;
  dob: string;
  gender: string;
  marital_status: string;
  occupation: string;
  annual_income: string;
  bank_account: string;
  bank_name: string;
  bank_branch: string;
  bank_ifsc: string;
  nominee_name: string;
  nominee_relation: string;
  nominee_dob: string;
  nominee_address: string;
  nominee_city: string;
  nominee_state: string;
  nominee_country: string;
  nominee_pin: string;
  nominee_mobile: string;
  nominee_email: string;
  nominee_pan: string;
  nominee_aadhar: string;
  nominee_bank_account: string;
  nominee_bank_name: string;
  nominee_bank_branch: string;
  nominee_bank_ifsc: string;
  nominee_bank_micr: string;
  nominee_bank_swift: string;
  nominee_bank_iban: string;
  nominee_bank_beneficiary: string;
  nominee_bank_beneficiary_address: string;
  nominee_bank_beneficiary_city: string;
  nominee_bank_beneficiary_state: string;
  nominee_bank_beneficiary_country: string;
  nominee_bank_beneficiary_pin: string;
  nominee_bank_beneficiary_mobile: string;
  nominee_bank_beneficiary_email: string;
  nominee_bank_beneficiary_pan: string;
  nominee_bank_beneficiary_aadhar: string;
  nominee_bank_beneficiary_bank_account: string;
  nominee_bank_beneficiary_bank_name: string;
  nominee_bank_beneficiary_bank_branch: string;
  nominee_bank_beneficiary_bank_ifsc: string;
  nominee_bank_beneficiary_bank_micr: string;
  nominee_bank_beneficiary_bank_swift: string;
  nominee_bank_beneficiary_bank_iban: string;
  fy_id: string;
  totp_key: string;
  app_id: string;
  app_type: string;
  client_id: string;
  client_name: string;
  client_email: string;
  client_mobile: string;
  client_pan: string;
  client_address: string;
  client_city: string;
  client_state: string;
  client_country: string;
  client_pin: string;
  client_dob: string;
  client_gender: string;
  client_marital_status: string;
  client_occupation: string;
  client_annual_income: string;
  client_bank_account: string;
  client_bank_name: string;
  client_bank_branch: string;
  client_bank_ifsc: string;
  client_nominee_name: string;
  client_nominee_relation: string;
  client_nominee_dob: string;
  client_nominee_address: string;
  client_nominee_city: string;
  client_nominee_state: string;
  client_nominee_country: string;
  client_nominee_pin: string;
  client_nominee_mobile: string;
  client_nominee_email: string;
  client_nominee_pan: string;
  client_nominee_aadhar: string;
  client_nominee_bank_account: string;
  client_nominee_bank_name: string;
  client_nominee_bank_branch: string;
  client_nominee_bank_ifsc: string;
  client_nominee_bank_micr: string;
  client_nominee_bank_swift: string;
  client_nominee_bank_iban: string;
  client_nominee_bank_beneficiary: string;
  client_nominee_bank_beneficiary_address: string;
  client_nominee_bank_beneficiary_city: string;
  client_nominee_bank_beneficiary_state: string;
  client_nominee_bank_beneficiary_country: string;
  client_nominee_bank_beneficiary_pin: string;
  client_nominee_bank_beneficiary_mobile: string;
  client_nominee_bank_beneficiary_email: string;
  client_nominee_bank_beneficiary_pan: string;
  client_nominee_bank_beneficiary_aadhar: string;
  client_nominee_bank_beneficiary_bank_account: string;
  client_nominee_bank_beneficiary_bank_name: string;
  client_nominee_bank_beneficiary_bank_branch: string;
  client_nominee_bank_beneficiary_bank_ifsc: string;
  client_nominee_bank_beneficiary_bank_micr: string;
  client_nominee_bank_beneficiary_bank_swift: string;
  client_nominee_bank_beneficiary_bank_iban: string;
}

export interface APIResponse<T> {
  s: 'ok' | 'error';
  code?: number;
  message?: string;
  data?: T;
}

export class FyersAPI {
  constructor(config: FyersConfig);
  
  generateAuthUrl(): string;
  generateAccessToken(authCode: string): Promise<APIResponse<AuthToken>>;
  getUserProfile(): Promise<APIResponse<UserProfile>>;
  validateToken(): Promise<APIResponse<any>>;
  refreshAccessToken(): Promise<APIResponse<AuthToken>>;
} 