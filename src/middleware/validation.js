import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);

export const signupSchema = {
    type: 'object',
    required: ['name', 'email', 'password'],
    properties: {
        name: { type: 'string', minLength: 3 },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string', minLength: 10 },
        password: { type: 'string', minLength: 6 },
        address: { type: 'string' },
    },
};

const signinSchema = {
    type: 'object',
    required: ['email', 'password'],
    properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string' },
    },
};

const updateUserSchema = {
    type: 'object',
    properties: {
        name: { type: 'string', minLength: 3 },
        phone: { type: 'string', minLength: 10 },
        address: { type: 'string' },
    },

    additionalProperties: false,
};

export const validateSignup = ajv.compile(signupSchema);
export const validateSignin = ajv.compile(signinSchema);
export const validateUserUpdate = ajv.compile(updateUserSchema);
