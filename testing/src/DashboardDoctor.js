import React, { useState, useEffect , useCallback } from 'react';
import Web3 from 'web3';
import PrescriptionContract from './PrescriptionContract.json';
import logo2 from './logo2.jpg';
import emailjs from '@emailjs/browser';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const DashboardDoctor = () => {
  // États correctement déclarés
  const [userEmail, setUserEmail] = useState('');
  const [prescriptions, setPrescriptions] = useState([]);
  const [userAddress, setUserAddress] = useState(null);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [patientAddress, setPatientAddress] = useState('');

  const [newPrescription, setNewPrescription] = useState({
    medicine: '', 
    dosage: '', 
    dosageUnit: 'gélule(s)', 
    frequency: '', 
    duration: '', 
    durationUnit: 'jour(s)',
    reminderTimes: []
  });
  const [timeInput, setTimeInput] = useState('');
  const [currentEditId, setCurrentEditId] = useState(null);

  const dosageUnits = ['gélule(s)', 'comprimé(s)', 'goutte(s)', 'mg', 'ml', 'cuillère(s)'];
  const durationUnits = ['jour(s)', 'semaine(s)', 'mois', 'année(s)'];

  
  const formatDuration = (days) => {
    const daysNum = parseInt(days);
    if (isNaN(daysNum)) return '0 jour';

    if (daysNum >= 365) {
      const years = Math.floor(daysNum / 365);
      const remainingDays = daysNum % 365;
      return `${years} année(s)` + (remainingDays > 0 ? ` et ${formatDuration(remainingDays)}` : '');
    }
    
    if (daysNum >= 30) {
      const months = Math.floor(daysNum / 30);
      const remainingDays = daysNum % 30;
      return `${months} mois` + (remainingDays > 0 ? ` et ${formatDuration(remainingDays)}` : '');
    }
    
    if (daysNum >= 7) {
      const weeks = Math.floor(daysNum / 7);
      const remainingDays = daysNum % 7;
      return `${weeks} semaine(s)` + (remainingDays > 0 ? ` et ${formatDuration(remainingDays)}` : '');
    }
    
    return `${daysNum} jour(s)`;
  };
  const loadDoctorPrescriptions = useCallback(async (contractInstance, doctorAddress) => {
    setLoading(true);
    try {
      const result = await contractInstance.methods
        .getDoctorPrescriptions(doctorAddress)
        .call({ from: doctorAddress });
  
      console.debug("Raw contract response:", result);
  
      // Helper pour normaliser les réponses (web3.js vs ethers)
      const normalizeResponse = (data) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (data.__length__) return Array.from({ length: data.__length__ }, (_, i) => data[i]);
        return Object.values(data).filter(v => typeof v !== 'number');
      };
  
      // Extraction des données normalisées
      const fields = [
        'ids', 'medicines', 'dosages', 'frequencies', 
        'durations', 'statuses', 'allReminderTimes', 
        'patients', 'isActiveFlags'
      ];
      
      const [
        ids, medicines, dosages, frequencies,
        durations, statuses, reminderTimes,
        patients, isActiveFlags
      ] = fields.map(field => normalizeResponse(result[field]));
  
      // Formatage final
      const prescriptions = ids.map((id, index) => ({
        id: parseInt(id),
        medicine: medicines[index]?.trim() || 'N/A',
        dosage: dosages[index]?.trim() || 'N/A',
        frequency: frequencies[index]?.trim() || 'N/A',
        duration: parseInt(durations[index]) || 0,
        status: statuses[index] ===1 ? "Taken" : "NotTaken",
        reminderTimes: Array.isArray(reminderTimes[index]) 
          ? reminderTimes[index].filter(t => t) 
          : [],
        patientAddress: patients[index] || '0x0',
        isActive: Boolean(isActiveFlags[index]),
        lastUpdated: Date.now()
      }));
  
      // Filtrage des prescriptions actives (optionnel)
      const activePrescriptions = prescriptions.filter(p => p.isActive);
      setPrescriptions(activePrescriptions);
  
    } catch (error) {
      console.error("Failed to load prescriptions:", {
        error,
        doctorAddress,
        contract: contractInstance.options.address
      });
      
      showErrorNotification(
        "Échec du chargement",
        error.message.includes("revert") 
          ? "Vous n'avez pas d'ordonnances" 
          : "Erreur réseau. Réessayez"
      );
      
      setPrescriptions([]); // Reset en cas d'erreur
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    //let subscription;
    
    const init = async () => {
      if (!window.ethereum) {
        alert("Veuillez installer MetaMask!");
        return;
      }
  
      try {
        const web3 = new Web3(window.ethereum);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const networkId = await web3.eth.net.getId();
        const deployedNetwork = PrescriptionContract.networks[networkId];
  
        if (!deployedNetwork) {
          alert("Contrat non déployé sur ce réseau.");
          return;
        }
  
        const instance = new web3.eth.Contract(
          PrescriptionContract.abi,
          deployedNetwork.address
        );
  
        // Vérification que l'événement existe
      if (!instance.events.PrescriptionStatusUpdated) {
        throw new Error("L'événement PrescriptionStatusUpdated n'est pas disponible");
      }

      // Écoute des événements avec la nouvelle syntaxe
     /* subscription = instance.events.PrescriptionStatusUpdated({
        filter: { doctor: accounts[0] },
        fromBlock: 'latest'
      })
      .on('data', event => {
        console.log("Événement reçu:", event);
        const { prescriptionId, newStatus, patient, doctor } = event.returnValues;
        if (doctor.toLowerCase() === accounts[0].toLowerCase()) {
          console.log(`Prescription ${prescriptionId} mise à jour: statut=${newStatus}`);
          loadDoctorPrescriptions(instance, accounts[0]);
        }
      })
      .on('changed', changed => console.log("Changed", changed))
      .on('error', err => console.error("Erreur d'écoute:", err));*/

        setContract(instance);
        setUserAddress(accounts[0]);
        
        const email = await instance.methods.getUserEmail(accounts[0]).call();
        setUserEmail(email);
        
        await loadDoctorPrescriptions(instance, accounts[0]);
  
      } catch (error) {
        console.error("Erreur initialisation:", error);
        alert(`Erreur: ${error.message}`);
      }
    };
  
    init();
  
    // Nettoyage
    return () => {
     /* if (subscription) {
        subscription.unsubscribe();
      }*/
    };
  }, [loadDoctorPrescriptions]);
  // Version améliorée de loadDoctorPrescriptions
  
  const showErrorNotification = (title, message) => {
    // Utilisation de votre bibliothèque de notification préférée
    toast.error(message, { title }); // Exemple avec react-toastify
    // Ou : alert(`${title}: ${message}`); // Solution basique
  };
  const loadPatientPrescriptions = async () => {
    if (!contract || !patientAddress) return;
  
    setLoading(true);
    try {
      const cleanAddress = patientAddress.trim();
  
      // Validate Ethereum address
      if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
        throw new Error("Adresse patient invalide");
      }
  
      // Check if patient is registered
      const isRegistered = await contract.methods.isUserRegistered(cleanAddress).call();
      if (!isRegistered) {
        throw new Error("Ce patient n'est pas enregistré dans le contrat.");
      }
  
      // Call the contract function
      const result = await contract.methods.getPatientPrescriptions(cleanAddress).call();
      console.log("Raw contract response:", result);
  
      // Convert the numbered-key object to an array
      const resultArray = Array.from({length: result.__length__}, (_, i) => result[i]);
  
      // Ensure we have all expected arrays
      if (resultArray.length !== 7) {
        throw new Error(`Format de réponse inattendu: attendu 7 tableaux, reçu ${resultArray.length}`);
      }
  
      const [medicines, dosages, frequencies, durations, statuses, reminderTimes, prescriptionIds] = resultArray;
  
      const prescriptionsFormatted = medicines.map((medicine, i) => ({
        id: Number(prescriptionIds[i]),
        medicine: medicine || '',
        dosage: dosages[i] || '',
        frequency: frequencies[i] || '',
        duration: Number(durations[i]) || 0,
        status: Number(statuses[i]) || 0,
        reminderTimes: Array.isArray(reminderTimes[i]) ? reminderTimes[i] : [],
        patientAddress: patientAddress 
      }));
  
      // Filter out potentially empty prescriptions
      const validPrescriptions = prescriptionsFormatted.filter(p => 
        p.medicine && p.id !== undefined
      );
  
      if (validPrescriptions.length === 0) {
        console.warn("Aucune prescription valide trouvée");
      }
  
      setPrescriptions(validPrescriptions);
    } catch (error) {
      console.error("Erreur lors du chargement des prescriptions patient:", error);
      alert(
        error.message.includes("revert")
          ? "Erreur lors de l'exécution du contrat intelligent: " + error.message
          : error.message
      );
    } finally {
      setLoading(false);
    }
  };
  const handleAddTime = () => {
    if (/^\d{2}:\d{2}$/.test(timeInput)) {
      setNewPrescription({
        ...newPrescription,
        reminderTimes: [...newPrescription.reminderTimes, timeInput],
      });
      setTimeInput('');
    } else {
      alert('Format invalide. Utilise HH:mm');
    }
  };

  const handleRemoveTime = (index) => {
    const updatedTimes = [...newPrescription.reminderTimes];
    updatedTimes.splice(index, 1);
    setNewPrescription({
      ...newPrescription,
      reminderTimes: updatedTimes
    });
  };

  const handleAddPrescription = async () => {
    // Validate inputs
    if (!patientAddress) {
      alert("Veuillez spécifier l'adresse du patient");
      return;
    }
    
    if (!newPrescription.medicine || !newPrescription.dosage || 
        !newPrescription.frequency || !newPrescription.duration) {
      alert("Veuillez remplir tous les champs obligatoires");
      return;
    }
  
    setSubmitting(true);
    
    try {
      // Convert duration to days
      const durationInDays = convertDurationToDays(
        newPrescription.duration, 
        newPrescription.durationUnit
      );
  
      // Verify permissions and patient status
      await verifyPermissionsAndPatient();
  
      const formattedDosage = `${newPrescription.dosage} ${newPrescription.dosageUnit}`;
      
      if (currentEditId !== null) {
        await updateExistingPrescription(durationInDays, formattedDosage);
      } else {
        await addNewPrescription(durationInDays, formattedDosage);
      }
  
      // Reset form and refresh data
      resetFormAndRefresh();
      
    } catch (error) {
      handleTransactionError(error);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Helper functions
  const convertDurationToDays = (duration, unit) => {
    const durationMap = {
      'semaine(s)': 7,
      'mois': 30,
      'année(s)': 365,
      'jour(s)': 1
    };
    return duration * (durationMap[unit] || 1);
  };
  
  const verifyPermissionsAndPatient = async () => {
    const [isDoctor, patientExists] = await Promise.all([
      contract.methods.isDoctor(userAddress).call(),
      contract.methods.isUserRegistered(patientAddress).call()
    ]);
    
    if (!isDoctor) throw new Error("Vous n'êtes pas enregistré comme médecin");
    if (!patientExists) throw new Error("Le patient n'est pas enregistré");
  };
  
  const updateExistingPrescription = async (durationInDays, formattedDosage) => {
    const tx = await contract.methods.modifyPrescription(
      currentEditId,
      newPrescription.medicine,
      formattedDosage,
      newPrescription.frequency,
      durationInDays.toString(),
      newPrescription.reminderTimes
    ).send({ 
      from: userAddress, 
      gas: 500000,
      gasPrice: '30000000000' // Explicit gas price to prevent underpriced tx
    });
    
    console.log("Modification TX hash:", tx.transactionHash);
    alert("Prescription modifiée avec succès !");
  };
  
  const addNewPrescription = async (durationInDays, formattedDosage) => {
    const tx = await contract.methods.addPrescription(
      patientAddress,
      newPrescription.medicine,
      formattedDosage,
      newPrescription.frequency,
      durationInDays.toString(),
      newPrescription.reminderTimes
    ).send({ 
      from: userAddress, 
      gas: 500000,
      gasPrice: '30000000000'
    });
  
    console.log("Ajout TX hash:", tx.transactionHash);
    await sendPrescriptionEmails(durationInDays, formattedDosage);
    alert("Prescription ajoutée avec succès !");
  };
  
  const sendPrescriptionEmails = async (durationInDays, formattedDosage) => {
    const formattedDuration = `${newPrescription.duration} ${newPrescription.durationUnit}`;
    
    try {
      await Promise.all(
        newPrescription.reminderTimes.map(time => 
          emailjs.send(
            'service_pwkq78h',
            'template_d6hyszl',
            {
              email: userEmail,
              user_name: userAddress,
              medicine: newPrescription.medicine,
              dosage: formattedDosage,
              duration: formattedDuration,
              formatted_duration: formatDuration(durationInDays),
              time: time
            },
            'NHS0R6CNHfPMrJbpS'
          )
        )
      );
    } catch (emailError) {
      console.warn("Erreur d'envoi d'email:", emailError);
      // Don't fail the whole operation if emails fail
    }
  };
  
  const resetFormAndRefresh = () => {
    setNewPrescription({
      medicine: '',
      dosage: '',
      dosageUnit: 'gélule(s)',
      frequency: '',
      duration: '',
      durationUnit: 'jour(s)',
      reminderTimes: []
    });
    setCurrentEditId(null);
    loadDoctorPrescriptions(contract, userAddress);
  };
  
  const handleTransactionError = (error) => {
    console.error("Erreur détaillée:", error);
    
    let errorMessage = "Erreur inconnue";
    if (error.code === 4001) {
      errorMessage = "Transaction annulée par l'utilisateur";
    } else if (error.message.includes("revert")) {
      // Try to extract revert reason
      const revertReason = error.reason || 
                          error.message.match(/reason: '(.*?)'/)?.[1] ||
                          "Raison non spécifiée";
      errorMessage = `Erreur du contrat: ${revertReason}`;
    } else if (error.message.includes("underpriced")) {
      errorMessage = "Prix du gaz trop bas, veuillez réessayer";
    } else if (error.message.includes("out of gas")) {
      errorMessage = "Limite de gaz dépassée, veuillez augmenter le gaz";
    }
  
    alert(errorMessage);
  };
  const handleRemovePrescription = async (prescriptionId) => {
    if (!window.confirm("Confirmer la suppression définitive ?")) return;
  
    setLoading(true);
    try {
      // Vérification améliorée de l'ID
      if (prescriptionId === undefined || prescriptionId === null) {
        throw new Error("ID de prescription non fourni");
      }
  
      // Convertir en nombre (au cas où c'est une string)
      const idNumber = Number(prescriptionId);
      if (isNaN(idNumber) || idNumber < 0) {
        throw new Error("ID de prescription doit être un nombre positif");
      }
  
      const tx = await contract.methods
        .removePrescription(idNumber)  // Envoie le nombre converti
        .send({ 
          from: userAddress,
          gas: 500000
        });
  
      if (tx.status) {
        await loadDoctorPrescriptions(contract, userAddress);
        alert("Suppression réussie !");
      }
    } catch (error) {
      console.error("Erreur suppression:", error);
      alert(`Échec de la suppression: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  const handleEditPrescription = (prescription) => {
    // Vérification que prescription existe
    if (!prescription) return;
  
    // Conversion sécurisée de la durée
    let durationValue = parseInt(prescription.duration) || 0; // Fallback à 0 si NaN
    let durationUnit = 'jour(s)';
    
    if (durationValue >= 365) {
      durationValue = Math.floor(durationValue / 365);
      durationUnit = 'année(s)';
    } else if (durationValue >= 30) {
      durationValue = Math.floor(durationValue / 30);
      durationUnit = 'mois';
    } else if (durationValue >= 7) {
      durationValue = Math.floor(durationValue / 7);
      durationUnit = 'semaine(s)';
    }
  
    // Extraction sécurisée du dosage
    const dosageParts = (prescription.dosage || '').toString().split(' ');
    const dosageStr = dosageParts[0] || '';
    const dosageUnitStr = dosageParts[1] || 'gélule(s)'; // Valeur par défaut
  
    setNewPrescription({
      medicine: prescription.medicine || '', // Fallback pour tous les champs
      dosage: dosageStr,
      dosageUnit: dosageUnits.includes(dosageUnitStr) ? dosageUnitStr : 'gélule(s)',
      frequency: prescription.frequency || '',
      duration: durationValue,
      durationUnit: durationUnit,
      reminderTimes: [...(prescription.reminderTimes || [])], // Fallback pour tableau
    });
  
    setCurrentEditId(prescription.id);
  };
  return (
    <div style={styles.container}>
      <img src={logo2} alt="Logo" style={styles.logo} />
      <h1 style={styles.title}>💊 Tableau de Bord Médicaments</h1>
      <p><strong>Adresse Ethereum :</strong> {userAddress}</p>
      <p><strong>Email :</strong> {userEmail}</p>
      
      <div style={styles.container1}>
        <div style={styles.inputContainer1}>
          <input 
            type="text"
            placeholder="Adresse Ethereum du patient"
            value={patientAddress}
            onChange={(e) => setPatientAddress(e.target.value)}
            style={styles.input1}
          />
        </div>
        <button 
          onClick={loadPatientPrescriptions} 
          style={styles.button1}
        >
          Rechercher Prescription Patient
        </button>
      </div>

      <h2 style={styles.sectionTitle}>Ajouter une Prescription</h2>
      <div style={styles.inputGroup}>
        <input 
          placeholder="Médicament *" 
          value={newPrescription.medicine}
          onChange={(e) => setNewPrescription({ ...newPrescription, medicine: e.target.value })}
          style={styles.input} 
        />
        
        <div style={styles.comboInputContainer}>
          <input 
            type="number"
            placeholder="Dosage *" 
            value={newPrescription.dosage}
            onChange={(e) => setNewPrescription({ ...newPrescription, dosage: e.target.value })}
            style={styles.comboInput} 
            min="1"
          />
          <select
            value={newPrescription.dosageUnit}
            onChange={(e) => setNewPrescription({ ...newPrescription, dosageUnit: e.target.value })}
            style={styles.comboSelect}
          >
            {dosageUnits.map(unit => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>
        
        <input 
          type="number"
          placeholder="Fréquence (par jour) *" 
          value={newPrescription.frequency}
          onChange={(e) => setNewPrescription({ ...newPrescription, frequency: e.target.value })}
          style={styles.input} 
          min="1"
        />
        
        <div style={styles.comboInputContainer}>
          <input 
            type="number"
            placeholder="Durée *" 
            value={newPrescription.duration}
            onChange={(e) => setNewPrescription({ ...newPrescription, duration: e.target.value })}
            style={styles.comboInput} 
            min="1"
          />
          <select
            value={newPrescription.durationUnit}
            onChange={(e) => setNewPrescription({ ...newPrescription, durationUnit: e.target.value })}
            style={styles.comboSelect}
          >
            {durationUnits.map(unit => (
              <option key={unit} value={unit}>{unit}</option>
            ))}
          </select>
        </div>
        
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
            <input 
              type="time" 
              value={timeInput} 
              onChange={(e) => setTimeInput(e.target.value)} 
              style={styles.timeInput} 
            />
            <button onClick={handleAddTime} style={styles.addTimeBtn}>
              + Ajouter rappel
            </button>
          </div>
          
          {newPrescription.reminderTimes.length > 0 && (
            <div style={styles.timesList}>
              <p>Rappels programmés :</p>
              <ul>
                {newPrescription.reminderTimes.map((time, index) => (
                  <li key={index} style={styles.timeItem}>
                    {time}
                    <button 
                      onClick={() => handleRemoveTime(index)} 
                      style={styles.removeTimeBtn}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <button 
          onClick={handleAddPrescription} 
          disabled={submitting} 
          style={styles.addBtn}
        >
          {submitting ? "En cours..." : 
           currentEditId !== null ? "Modifier Prescription" : "Ajouter Prescription"}
        </button>
      </div>

      {loading ? (
        <p style={styles.loading}>⏳ Chargement des prescriptions...</p>
      ) : (
        <div>
          <h2 style={styles.sectionTitle}>
            {patientAddress ? `Prescriptions du patient` : 'Mes Prescriptions'}
          </h2>
          {prescriptions.length === 0 ? (
            <p style={styles.noPrescriptions}>Aucune prescription disponible.</p>
          ) : (
            prescriptions.map((p) => (
              <div key={p.id} style={styles.card}>
                <div style={styles.patientAddress}>
                  <strong>Patient:</strong> {p.patientAddress}
                </div>
                <p><strong>Médicament :</strong> {p.medicine}</p>
                <p><strong>Dosage :</strong> {p.dosage}</p>
                <p><strong>Fréquence :</strong> {p.frequency} fois/jour</p>
                <p>
                  <strong>Durée :</strong> 
                  <span title={`${p.duration} jours`}>
                    {formatDuration(p.duration)}
                  </span>
                </p>
                {p.reminderTimes.length > 0 && (
                  <p><strong>Rappels :</strong> {p.reminderTimes.join(', ')}</p>
                )}
                <p>
                  <strong>Statut :</strong>{" "}
                  <span style={{ color: p.status === "1" ? "#4caf50" : "#f44336" }}>
                    {p.status === "1" ? "✔️ Pris" : "❌ Non pris"}
                  </span>
                </p>
            
                <div style={styles.buttonGroup}>
                  <button 
                    onClick={() => handleRemovePrescription(p.id)} 
                    style={styles.deleteBtn}
                  >
                    🗑 Supprimer
                  </button>
                  <button 
                    onClick={() => handleEditPrescription(p)} 
                    style={styles.editBtn}
                  >
                    ✏️ Modifier
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const styles = {

  patientAddress: {
    backgroundColor: '#f0f7ff',
    padding: '8px',
    borderRadius: '6px',
    fontSize: '0.75em',
    fontFamily: 'monospace',
    marginBottom: '10px',
    wordBreak: 'break-all',
    borderLeft: '3px solid #3498db'
  },
  container1: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '10px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '400px',
    margin: 'auto'
  },
  inputContainer1: {
    marginBottom: '20px',
    width: '100%'
  },
  input1: {
    width: '100%',
    padding: '10px',
    borderRadius: '5px',
    border: '1px solid #ccc',
    fontSize: '16px',
    boxSizing: 'border-box',
    transition: 'border-color 0.3s ease',
  },
  button1: {
    padding: '10px 20px',
    backgroundColor: '#00796b',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    width: '100%',
    boxSizing: 'border-box',
  },
  editBtn: {
    backgroundColor: "#6a1b9a",
    color: "white",
    border: "none",
    padding: "10px 15px",
    borderRadius: "6px",
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#5e35b1'
    }
  },
  logo: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    objectFit: 'cover',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  },
  container: { 
    padding: "20px", 
    maxWidth: "800px", 
    margin: "auto", 
    backgroundColor: "#fff3f8", 
    borderRadius: "12px",
    position: 'relative',
    paddingTop: '80px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    fontFamily: 'Arial, sans-serif'
  },
  title: { 
    textAlign: "center", 
    color: "#c2185b", 
    fontSize: "28px",
    marginBottom: '20px',
    textShadow: '1px 1px 2px rgba(0,0,0,0.1)'
  },
  sectionTitle: { 
    color: "#ad1457", 
    marginTop: "20px",
    borderBottom: '2px solid #f8bbd0',
    paddingBottom: '5px',
    fontSize: '22px'
  },
  inputGroup: { 
    display: "flex", 
    flexDirection: "column", 
    gap: "15px",
    backgroundColor: '#f8e1e7',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '20px',
    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)'
  },
  input: { 
    padding: "12px", 
    borderRadius: "6px", 
    border: "1px solid #f8bbd0",
    fontSize: '16px',
    backgroundColor: 'white'
  },
  comboInputContainer: {
    display: 'flex',
    gap: '10px'
  },
  comboInput: {
    flex: 3,
    padding: "12px", 
    borderRadius: "6px", 
    border: "1px solid #f8bbd0",
    fontSize: '16px',
    backgroundColor: 'white'
  },
  comboSelect: {
    flex: 2,
    padding: "12px", 
    borderRadius: "6px", 
    border: "1px solid #f8bbd0",
    backgroundColor: 'white',
    fontSize: '16px',
    cursor: 'pointer'
  },
  timeInput: { 
    padding: "10px", 
    borderRadius: "6px", 
    border: "1px solid #f8bbd0",
    fontSize: '16px',
    backgroundColor: 'white'
  },
  addTimeBtn: { 
    marginLeft: "10px", 
    backgroundColor: "#7b1fa2", 
    color: "white", 
    padding: "10px 15px", 
    borderRadius: "6px",
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#6a1b9a'
    }
  },
  timesList: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    padding: '10px',
    borderRadius: '6px'
  },
  timeItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '5px 0'
  },
  removeTimeBtn: {
    backgroundColor: '#ffcdd2',
    border: 'none',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    cursor: 'pointer',
    color: '#c62828',
    ':hover': {
      backgroundColor: '#ef9a9a'
    }
  },
  addBtn: { 
    backgroundColor: "#00796b", 
    color: "white", 
    padding: "14px", 
    border: "none", 
    borderRadius: "6px", 
    marginTop: "10px",
    fontSize: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
    fontWeight: 'bold',
    ':hover': {
      backgroundColor: '#00695c'
    }
  },
  card: { 
    backgroundColor: "#fce4ec", 
    padding: "20px", 
    borderRadius: "8px", 
    marginBottom: "15px", 
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    borderLeft: '4px solid #c2185b',
    transition: 'transform 0.2s',
    ':hover': {
      transform: 'translateY(-2px)'
    }
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
    flexWrap: 'wrap'
  },
  deleteBtn: { 
    backgroundColor: "#e53935", 
    color: "white", 
    border: "none", 
    padding: "10px 15px", 
    borderRadius: "6px",
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#c62828'
    }
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    color: '#7b1fa2',
    fontSize: '18px'
  },
  noPrescriptions: {
    textAlign: 'center',
    padding: '20px',
    color: '#666',
    fontStyle: 'italic'
  }
};

export default DashboardDoctor;