// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

contract PrescriptionContract {
    // Énumérations pour l'état de la prescription et le rôle de l'utilisateur
    enum PrescriptionStatus { NotTaken, Taken }
    enum Role { Patient, Doctor }
    // Structure d'une prescription médicale
    struct Prescription {
        string medicine;
        string dosage;
        string frequency;
        uint duration;
        PrescriptionStatus status;
        string[] reminderTimes;
        address patient;
        address doctor;
        bool isActive;
    }
    // Structure d’un utilisateur du système (Patient ou Médecin)
    struct User {
        bytes32 passwordHash;
        string email; 
        bool exists;  // Vérifie si l'utilisateur est enregistré
        Role role; // Rôle : Patient ou Médecin
    }

    // Stockage principal
    Prescription[] private allPrescriptions;   // Toutes les prescriptions enregistrées
    mapping(address => uint[]) private patientPrescriptionIndexes;  // Mapping patient -> index des prescriptions
    mapping(address => uint[]) private doctorPrescriptionIndexes;  // Mapping médecin -> index des prescriptions
    mapping(address => User) private users;  // Mapping utilisateur -> infos utilisateur

    // Événements
    event PrescriptionAdded(
        address indexed doctor,
        address indexed patient,
        uint prescriptionId,
        string medicine,
        string dosage,
        string frequency,
        uint duration,
        string[] reminderTimes
    );

    event PrescriptionStatusUpdated (uint indexed prescriptionId, uint newStatus );

    event PrescriptionModified(
        address indexed doctor,
        address indexed patient,
        uint prescriptionId,
        string medicine,
        string dosage,
        string frequency,
        uint duration,
        string[] reminderTimes
    );

   event PrescriptionRemoved(
    address indexed patient,
    uint indexed prescriptionId,
    address indexed doctor,
    bool isActive,
    uint256 timestamp
);

    event UserRegistered(address indexed userAddress, Role role);

    // Modificateurs
    modifier onlyRegistered() {
        require(users[msg.sender].exists, "User not registered");
        _;
    }

    modifier onlyDoctor() {
        require(users[msg.sender].exists && users[msg.sender].role == Role.Doctor, "Only doctors can perform this action");
        _;
    }

    // Fonctions utilisateur
    function registerUser(bytes32 _passwordHash, string memory _email, Role _role) public {
        require(!users[msg.sender].exists, "User already registered");
        users[msg.sender] = User({
            passwordHash: _passwordHash,
            email: _email,
            exists: true,
            role: _role
        });

        emit UserRegistered(msg.sender, _role);
    }

    function getUserEmail(address _user) public view returns (string memory) {
        require(users[_user].exists, "User not registered");
        return users[_user].email;
    }

    function verifyUser(bytes32 _passwordHash, string memory _email) public view returns (bool) {
        require(users[msg.sender].exists, "User not registered");
        User memory user = users[msg.sender];
        return (user.passwordHash == _passwordHash &&
                keccak256(abi.encodePacked(user.email)) == keccak256(abi.encodePacked(_email)));
    }

    function isUserRegistered(address _user) public view returns (bool) {
        return users[_user].exists;
    }

    function isDoctor(address _user) public view returns (bool) {
        return users[_user].exists && users[_user].role == Role.Doctor;
    }

    // Fonctions de prescription
    function addPrescription(
        address _patient,
        string memory _medicine,
        string memory _dosage,
        string memory _frequency,
        uint _duration,
        string[] memory _reminderTimes
    ) public onlyDoctor {
        require(users[_patient].exists && users[_patient].role == Role.Patient, "Invalid patient");
        require(bytes(_medicine).length > 0, "Medicine cannot be empty");
        require(_duration > 0, "Duration must be positive");
        require(_reminderTimes.length > 0, "At least one reminder required");

        uint newId = allPrescriptions.length;
        allPrescriptions.push(Prescription({
            medicine: _medicine,
            dosage: _dosage,
            frequency: _frequency,
            duration: _duration,
            status: PrescriptionStatus.NotTaken,
            reminderTimes: _reminderTimes,
            patient: _patient,
            doctor: msg.sender,
            isActive: true 
        }));

        patientPrescriptionIndexes[_patient].push(newId);
        doctorPrescriptionIndexes[msg.sender].push(newId);

        emit PrescriptionAdded(msg.sender, _patient, newId, _medicine, _dosage, _frequency, _duration, _reminderTimes);
    }

    function updatePrescriptionStatus(uint _id, uint _status) public {
        require(allPrescriptions[_id].patient == msg.sender || 
           allPrescriptions[_id].doctor == msg.sender, "Non autorise");
    allPrescriptions[_id].status = PrescriptionStatus(_status);
        emit PrescriptionStatusUpdated(_id, _status);
    }

    function modifyPrescription(
        uint _prescriptionId,
        string memory _medicine,
        string memory _dosage,
        string memory _frequency,
        uint _duration,
        string[] memory _reminderTimes
    ) public onlyDoctor {
        require(_prescriptionId < allPrescriptions.length, "Invalid prescription ID");
        Prescription storage prescription = allPrescriptions[_prescriptionId];
        //require(msg.sender == prescription.doctor, "Only prescribing doctor can modify");

        prescription.medicine = _medicine;
        prescription.dosage = _dosage;
        prescription.frequency = _frequency;
        prescription.duration = _duration;
        prescription.reminderTimes = _reminderTimes;

        emit PrescriptionModified(msg.sender, prescription.patient, _prescriptionId, _medicine, _dosage, _frequency, _duration, _reminderTimes);
    }

  
function removePrescription(
    uint256 _prescriptionId
) public onlyDoctor {
    require(_prescriptionId < allPrescriptions.length, "Prescription does not exist");
    
    Prescription storage prescription = allPrescriptions[_prescriptionId];
    
    /*require(
        msg.sender == prescription.doctor,
        "Only prescribing doctor can remove prescription"
    );*/
    require(
        prescription.isActive,
        "Prescription is already inactive"
    );

    // Désactive la prescription
    prescription.isActive = false;

    // Émet l'événement avec toutes les informations pertinentes
    emit PrescriptionRemoved( prescription.patient,
        _prescriptionId,
        msg.sender,
        prescription.isActive,
        block.timestamp
    );
}



    
    // Fonctions de consultation
function getPatientPrescriptions(address _patient) public view returns (
        string[] memory,
        string[] memory,
        string[] memory,
        uint[] memory,
        PrescriptionStatus[] memory,
        string[][] memory,
        uint[] memory // Pour renvoyer les IDs dans React
    ) {
        uint total = patientPrescriptionIndexes[_patient].length;
        uint activeCount = 0;

        for (uint i = 0; i < total; i++) {
            uint index = patientPrescriptionIndexes[_patient][i];
            if (allPrescriptions[index].isActive) {
                activeCount++;
            }
        }

        string[] memory medicines = new string[](activeCount);
        string[] memory dosages = new string[](activeCount);
        string[] memory frequencies = new string[](activeCount);
        uint[] memory durations = new uint[](activeCount);
        PrescriptionStatus[] memory statuses = new PrescriptionStatus[](activeCount);
        string[][] memory reminders = new string[][](activeCount);
        uint[] memory prescriptionIds = new uint[](activeCount);

        uint j = 0;
        for (uint i = 0; i < total; i++) {
            uint index = patientPrescriptionIndexes[_patient][i];
            Prescription storage p = allPrescriptions[index];
            if (p.isActive) {
                medicines[j] = p.medicine;
                dosages[j] = p.dosage;
                frequencies[j] = p.frequency;
                durations[j] = p.duration;
                statuses[j] = p.status;
                reminders[j] = p.reminderTimes;
                prescriptionIds[j] = index;
                j++;
            }
        }

        return (medicines, dosages, frequencies, durations, statuses, reminders, prescriptionIds);
    }
    function getDoctorPrescriptions(address _doctor) public view returns (
    uint[] memory ids,
    string[] memory medicines,
    string[] memory dosages,
    string[] memory frequencies,
    uint[] memory durations,
    uint8[] memory statuses,
    string[][] memory allReminderTimes,
    address[] memory patients,
    bool[] memory isActiveFlags 
) {
    uint[] memory indexes = doctorPrescriptionIndexes[_doctor];
    uint activeCount = 0;

    for (uint i = 0; i < indexes.length; i++) {
        if (allPrescriptions[indexes[i]].isActive) {
            activeCount++;
        }
    }

    ids = new uint[](activeCount);
    medicines = new string[](activeCount);
    dosages = new string[](activeCount);
    frequencies = new string[](activeCount);
    durations = new uint[](activeCount);
    statuses = new uint8[](activeCount);
    allReminderTimes = new string[][](activeCount);
    patients = new address[](activeCount);
    isActiveFlags = new bool[](activeCount);

    uint j = 0;
    for (uint i = 0; i < indexes.length; i++) {
        uint id = indexes[i];
        Prescription storage p = allPrescriptions[id];
        if (p.isActive) {
            ids[j] = id;
            medicines[j] = p.medicine;
            dosages[j] = p.dosage;
            frequencies[j] = p.frequency;
            durations[j] = p.duration;
            statuses[j] = uint8(p.status);
            allReminderTimes[j] = p.reminderTimes;
            patients[j] = p.patient;
            isActiveFlags[j] = p.isActive;
            j++;
        }
    }
}

    function getPrescriptionDetails(uint _prescriptionId) public view returns (
        string memory,
        string memory,
        string memory,
        uint,
        PrescriptionStatus,
        string[] memory,
        address,
        address
    ) {
        require(_prescriptionId < allPrescriptions.length, "Invalid prescription ID");
        Prescription storage p = allPrescriptions[_prescriptionId];
        require(bytes(p.medicine).length > 0, "Prescription does not exist");

        return (
            p.medicine,
            p.dosage,
            p.frequency,
            p.duration,
            p.status,
            p.reminderTimes,
            p.patient,
            p.doctor
        );
    }

    function getPatientPrescriptionCount(address _patient) public view returns (uint) {
        return patientPrescriptionIndexes[_patient].length;
    }

    function getDoctorPrescriptionCount(address _doctor) public view returns (uint) {
        return doctorPrescriptionIndexes[_doctor].length;
    }
}
