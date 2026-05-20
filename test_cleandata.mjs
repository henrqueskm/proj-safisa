import { cleanData } from './hooks/useOrderManagement.js';

var userData = {
  id: "some-id",
  name: "Rafael",
  username: "rafa",
  passwordHash: "123",
  permissions: ["ADMIN"],
  linkedRepresentative: undefined
};

console.log(cleanData(userData));
