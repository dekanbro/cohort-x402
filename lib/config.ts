import { getEnv, optEnv } from './env';

// Prefer NEXT_PUBLIC_ prefixed facilitator for runtime/frontend overrides, then server-side var, then fallback
export const DEFAULT_FACILITATOR = optEnv('NEXT_PUBLIC_X402_FACILITATOR_URL') || optEnv('X402_FACILITATOR_URL') || 'http://localhost:9000';
export const X402_NETWORK = optEnv('X402_NETWORK', 'base')!;
export const USDC_BASE_ADDRESS = optEnv('USDC_BASE_ADDRESS', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')!;
export const SERVICE_RECIPIENT_ADDRESS = optEnv('SERVICE_RECIPIENT_ADDRESS', '0xSERVICE_RECIPIENT_PLACEHOLDER')!;
export const PRICE_IN_USDC = optEnv('PRICE_IN_USDC', '0.0001')!;

// Helper to require critical values at startup when needed
export function requireConfig() {
	// Example: require SERVICE_RECIPIENT_ADDRESS in production
	if (process.env.NODE_ENV === 'production') {
		getEnv('SERVICE_RECIPIENT_ADDRESS');
	}
}
