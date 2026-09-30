/**
 * The contract's limit on what a request says needs doing (`JobInput.description`).
 *
 * In a module of its own rather than beside the box that asks for it: that component is a client
 * one, and a server component importing a value from it receives a client reference, not 2000.
 */
export const DESCRIPTION_MAX = 2000;
