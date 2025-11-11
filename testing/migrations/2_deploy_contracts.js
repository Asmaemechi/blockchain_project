const PrescriptionContract = artifacts.require("PrescriptionContract");

module.exports = function (deployer) {
  deployer.deploy(PrescriptionContract);
};