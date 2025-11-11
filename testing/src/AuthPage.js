import React, { useState } from "react";
import Web3 from "web3";
import { useNavigate } from 'react-router-dom';
import PrescriptionContract from '././PrescriptionContract.json';
import { sha256 } from 'js-sha256'; // Ajoutez cette importation
import logo2 from '././logo2.jpg'; // adapte le chemin si besoin
import emailjs from '@emailjs/browser';

const AuthPage = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [userAddress, setUserAddress] = useState(null);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");  // Ajout de l'état pour l'email
  const [isRegistering, setIsRegistering] = useState(false);
  const [role, setRole] = useState(""); 
  const navigate = useNavigate();

  // Fonction pour hasher le mot de passe
  const hashPassword = (password) => {
    return '0x' + sha256(password);
  };

  const checkMetaMask = async () => {
    if (window.ethereum) {
      const web3 = new Web3(window.ethereum);
      try {
        const accounts = await web3.eth.requestAccounts();
        if (accounts.length > 0) {
          setUserAddress(accounts[0]);
          setIsConnected(true);
        } else {
          alert("Veuillez connecter votre portefeuille MetaMask.");
        }
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la connexion avec MetaMask.");
      }
    } else {
      alert("MetaMask n'est pas installé. Veuillez l'installer.");
    }
  };

  const handlePassword = (e) => setPassword(e.target.value);
  const handleEmail = (e) => setEmail(e.target.value);  // Gestion de l'email

  // Modifiez la fonction register
  const register = async () => {
    if (!password || !email) {
        alert("Veuillez entrer un email et un mot de passe");
        return;
    }

    try {
        const web3 = new Web3(window.ethereum);
        const networkId = await web3.eth.net.getId();
        const networkData = PrescriptionContract.networks[networkId];

        if (!networkData) {
            alert("Smart contract non déployé sur ce réseau");
            return;
        }

        const contract = new web3.eth.Contract(
            PrescriptionContract.abi,
            networkData.address
        );

        const passwordHash = hashPassword(password);
        const gasEstimate = await contract.methods.registerUser(passwordHash, email ,parseInt(role)).estimateGas({ from: userAddress });
        
        await contract.methods.registerUser(passwordHash, email,parseInt(role))
            .send({ from: userAddress, gas: gasEstimate })
            .on('receipt', (receipt) => {
                // Vérifie que l'email est valide avant d'envoyer l'email
                if (email && email.includes('@')) {
                    emailjs.send(
                        'service_pwkq78h',  // Remplace par ton ID de service EmailJS
                        'template_t2lc09h',  // Remplace par ton ID de template EmailJS
                        {
                            email: email,
                            name: userAddress,
                        },
                        'NHS0R6CNHfPMrJbpS' // Remplace par ton User ID EmailJS
                    ).then(
                        (response) => console.log('E-mail envoyé avec succès:', response),
                        (error) => console.error('Erreur lors de l\'envoi de l\'e-mail:', error)
                    );
                } else {
                    console.error('Adresse e-mail invalide');
                }
            });

        alert("Compte créé avec succès !");
        setIsRegistering(false);
        if (parseInt(role) === 1) {
          navigate("/dashboarddoctor");
        } else if (parseInt(role) === 0) {
          navigate("/dashboardpatient");
        }
    } catch (err) {
        console.error("Erreur lors de l'inscription :", err);
        alert("Erreur lors de l'inscription: " + err.message);
    }
};
  // Modifiez la fonction authenticate
  const authenticate = async () => {
    if (!password) {
        alert("Veuillez saisir votre mot de passe");
        return;
    }

    try {
        const web3 = new Web3(window.ethereum);
        const networkId = await web3.eth.net.getId();
        const networkData = PrescriptionContract.networks[networkId];

        if (!networkData) {
            alert("Smart contract non déployé sur ce réseau");
            return;
        }

        const contract = new web3.eth.Contract(
            PrescriptionContract.abi,
            networkData.address
        );

        // Vérification si l'utilisateur est enregistré
        const isRegistered = await contract.methods.isUserRegistered(userAddress).call();
        
        if (!isRegistered) {
            alert("Utilisateur non enregistré");
            return;
        }

        // Vérification du mot de passe
        const inputHash = hashPassword(password);
        const isValid = await contract.methods
            .verifyUser(inputHash, email)
            .call({ from: userAddress });
        if (isValid) {
          const isDoctor = await contract.methods
        .isDoctor(userAddress)
        .call({ from: userAddress });

      alert("Connexion réussie !");
        // Stockage de l'état d'authentification
      localStorage.setItem("userAddress", userAddress);
      localStorage.setItem("role", isDoctor ? "doctor" : "patient");
          
      if (isDoctor) navigate("/dashboarddoctor");
      else navigate("/dashboardpatient");
    } else {
      alert("Identifiants incorrects !");
    }
    } catch (err) {
        console.error(err);
        alert("Erreur lors de l'authentification");
    }
  };

  return (
    <div style={styles.container}>
      <img src={logo2} alt="Logo" style={styles.logo} />
      <div style={styles.content}>
        

        <h1 style={styles.title}>Connexion sécurisée</h1>
        {!isConnected ? (
          <button style={styles.button} onClick={checkMetaMask}>Connecter MetaMask</button>
        ) : (
          <>
            <p style={styles.userAddress}>Adresse wallet : {userAddress}</p>
            <input
              type="email" // Champ pour l'email
              placeholder="Email"
              value={email}
              onChange={handleEmail}
              style={styles.input}
            />
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={handlePassword}
              style={styles.input}
            />
<select value={role} onChange={(e) => setRole(e.target.value)} style={styles.input}>
  <option value="">Choisissez un rôle</option>
  <option value="0">Patient</option>
  <option value="1">Médecin</option>
</select>
            {isRegistering ? (
              <>
                <button style={styles.button} onClick={register}>Créer un compte</button>
                <button style={styles.secondaryButton} onClick={() => setIsRegistering(false)}>Annuler</button>
              </>
            ) : (
              <>
                <button style={styles.button} onClick={authenticate}>Se connecter</button>
                <button style={styles.secondaryButton} onClick={() => setIsRegistering(true)}>S'inscrire</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
// styles.js (inline dans ton fichier comme tu as fait)

const styles = {
  logo: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    objectFit: 'cover',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
    transition: 'transform 0.3s ease',
  },

  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
    background: 'linear-gradient(to right, #f8bbd0, #f48fb1, #f06292)',
    fontFamily: "'Poppins', sans-serif",
    animation: 'fadeIn 1s ease-in-out',
  },

  content: {
    background: '#fff',
    padding: '40px',
    borderRadius: '20px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
    width: '100%',
    maxWidth: '450px',
    textAlign: 'center',
    transition: 'transform 0.3s ease',
    animation: 'slideUp 0.6s ease-in-out',
  },

  title: {
    fontSize: '2.2rem',
    fontWeight: '700',
    marginBottom: '25px',
    color: '#d81b60',
    letterSpacing: '1px',
  },

  userAddress: {
    fontSize: '0.85rem',
    marginBottom: '14px',
    color: '#616161',
    wordBreak: 'break-word',
  },

  input: {
    width: '100%',
    padding: '14px',
    margin: '10px 0',
    border: '1px solid #ddd',
    borderRadius: '12px',
    fontSize: '15px',
    outline: 'none',
    transition: 'all 0.3s ease',
    backgroundColor: '#fafafa',
  },

  button: {
    width: '100%',
    padding: '14px',
    margin: '12px 0',
    borderRadius: '12px',
    background: 'linear-gradient(90deg, #ec407a, #d81b60)',
    color: 'white',
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 8px 16px rgba(216, 27, 96, 0.2)',
    transition: 'transform 0.3s ease, background 0.3s ease',
  },

  secondaryButton: {
    width: '100%',
    padding: '14px',
    margin: '10px 0',
    borderRadius: '12px',
    backgroundColor: '#fff',
    color: '#d81b60',
    border: '2px solid #d81b60',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  }
};



export default AuthPage;
