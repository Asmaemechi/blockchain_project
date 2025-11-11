import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import PrescriptionContract from './PrescriptionContract.json';
import logo2 from './logo2.jpg';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
const DashboardPatient = () => {
  const [userEmail, setUserEmail] = useState('');
  const [prescriptions, setPrescriptions] = useState([]);
  const [userAddress, setUserAddress] = useState(null);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fonction pour formater la durée
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

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          const web3 = new Web3(window.ethereum);
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          setUserAddress(accounts[0]);

          const networkId = await web3.eth.net.getId();
          const deployedNetwork = PrescriptionContract.networks[networkId];

          if (deployedNetwork) {
            const instance = new web3.eth.Contract(
              PrescriptionContract.abi,
              deployedNetwork.address
            );
            setContract(instance);
            const email = await instance.methods.getUserEmail(accounts[0]).call();
            setUserEmail(email);
            await loadPrescriptions(instance, accounts[0]);
          } else {
            alert("Contrat non déployé sur ce réseau.");
          }
        } catch (error) {
          console.error("Erreur initialisation:", error);
          alert(`Erreur de connexion: ${error.message}`);
        }
      } else {
        alert("Veuillez installer MetaMask!");
      }
    };
    init();
  }, []);

  const loadPrescriptions = async (contractInstance, address) => {
    setLoading(true);
    try {
      const cleanAddress = address.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddress)) {
        throw new Error("Adresse Ethereum invalide");
      }
  
      const result = await contractInstance.methods.getPatientPrescriptions(cleanAddress).call();
      console.log("Raw contract response:", result);

      // Handle both array and object responses
      let resultArray;
      if (Array.isArray(result)) {
        resultArray = result;
      } else if (result && result.__length__) {
        // Convert numbered-key object to array
        resultArray = Array.from({length: result.__length__}, (_, i) => result[i]);
      } else {
        throw new Error("Format de réponse inattendu du contrat");
      }

      // Ensure we have all required arrays
      if (resultArray.length < 7) {
        throw new Error(`Réponse incomplète: ${resultArray.length} tableaux reçus au lieu de 7`);
      }

      const [
        medicines = [],
        dosages = [],
        frequencies = [],
        durations = [],
        statuses = [],
        reminderTimes = [],
        prescriptionIds = []
      ] = resultArray;
  
      const prescriptionsFormatted = medicines.map((medicine, index) => ({
        id: Number(prescriptionIds[index] ?? index), // Fallback to index if IDs missing
        medicine: medicine || 'Inconnu',
        dosage: dosages[index] || 'Non spécifié',
        frequency: frequencies[index] || 'Non spécifiée',
        duration: Number(durations[index]) || 0,
        status: statuses[index] === "1" || statuses[index] === 1 ? "Taken" : "NotTaken",
        reminderTimes: Array.isArray(reminderTimes[index]) ? reminderTimes[index] : []
      }));
  
      setPrescriptions(prescriptionsFormatted.filter(p => p.medicine && p.medicine !== 'Inconnu'));
    } catch (error) {
      console.error("Erreur chargement prescriptions:", error);
      alert(`Erreur: ${error.message}`);
      setPrescriptions([]);
    } finally {
      setLoading(false);
    }
  };

 // Dans handleUpdateStatus
 const handleUpdateStatus = async (prescriptionId, newStatus) => {
  try {
    if (!contract || !userAddress) {
      throw new Error("Contrat non initialisé");
    }

    // Mise à jour optimiste UI
    setPrescriptions(prev => prev.map(p => 
      p.id === prescriptionId ? {...p, status: newStatus} : p
    ));

    // Estimation du gas limit
    const gasEstimate = await contract.methods
      .updatePrescriptionStatus(prescriptionId, newStatus)
      .estimateGas({ from: userAddress });

    // Envoi avec buffer de sécurité
    await contract.methods
      .updatePrescriptionStatus(prescriptionId, newStatus)
      .send({ 
        from: userAddress,
        gas: Math.floor(gasEstimate * 1.2) // 20% de buffer
      });

    toast.success("Statut mis à jour avec succès");
    await loadPrescriptions(contract, userAddress);

  } catch (error) {
    console.error("Erreur transaction:", error);
    
    // Rollback UI
    setPrescriptions(prev => prev.map(p => 
      p.id === prescriptionId ? {...p, status: p.status} : p
    ));

    // Messages d'erreur spécifiques
    if (error.code === 4001) {
      toast.error("Transaction annulée par l'utilisateur");
    } else if (error.message.includes("revert")) {
      toast.error("Opération rejetée par le contrat");
    } else {
      toast.error(`Échec de la mise à jour: ${error.message}`);
    }
  }
};
  const handleMarkAsTaken = async (prescriptionId) => {
    // Simplement appeler handleUpdateStatus avec statut "1"
    await handleUpdateStatus(prescriptionId, "1");
  };
  
  return (
    <div style={styles.container}>
      <img src={logo2} alt="Logo" style={styles.logo} />
      <h1 style={styles.title}>💊 Tableau de Bord Patient</h1>
      <p><strong>Adresse Ethereum :</strong> {userAddress}</p>
      <p><strong>Email :</strong> {userEmail}</p>

      {loading ? (
        <p style={styles.loading}>⏳ Chargement des prescriptions...</p>
      ) : (
        <div>
          <h2 style={styles.sectionTitle}>Mes Prescriptions</h2>
          {prescriptions.length === 0 ? (
            <p style={styles.noPrescriptions}>Aucune prescription disponible.</p>
          ) : (
            prescriptions.map((p) => (
              <div key={p.id} style={styles.card}>
                <p><strong>Médicament :</strong> {p.medicine}</p>
                <p><strong>Dosage :</strong> {p.dosage}</p>
                <p><strong>Fréquence :</strong> {p.frequency}</p>
                <p>
                  <strong>Durée :</strong> 
                  <span title={`${p.duration} jours`}>
                    {formatDuration(p.duration)}
                  </span>
                </p>
                {p.reminderTimes.length > 0 && (
                  <p><strong>Rappels :</strong> {p.reminderTimes.join(', ')}</p>
                )}
                <div style={styles.statusContainer}>
  {/* Solution avec select */}
  <select
    value={p.status}
    onChange={(e) => handleUpdateStatus(p.id, e.target.value)}
    style={{
      ...styles.statusSelect,
      backgroundColor: p.status === "1" ? "#e8f5e9" : "#ffebee",
      color: p.status === "1" ? "#4caf50" : "#e53935",
      border: p.status === "1" ? "1px solid #4caf50" : "1px solid #e53935",
      transition: "all 0.3s ease"
    }}
  >
    <option value="0">🟥 Non pris</option>
    <option value="1">✅ Pris</option>
  </select>

  {/* Bouton alternatif (optionnel) */}
  {p.status === "0" && (
    <button 
      onClick={() => handleMarkAsTaken(p.id)} 
      style={{
        ...styles.takenBtn,
        marginLeft: "10px"
      }}
    >
      ✔ Marquer comme pris
    </button>
  )}
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
  takenBtn: { 
    backgroundColor: "#4caf50", 
    color: "white", 
    border: "none", 
    padding: "10px 15px", 
    borderRadius: "6px",
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#3d8b40'
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

export default DashboardPatient;