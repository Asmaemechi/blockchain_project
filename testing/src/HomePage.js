import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaPills } from 'react-icons/fa';

const HomePage = () => {
  const navigate = useNavigate();

  const handleStartClick = () => {
    navigate('/auth');
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        backgroundImage: 'url("/img1.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        fontFamily: "'Poppins', sans-serif",
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        style={{
          background: 'rgba(255, 255, 255, 0.92)',
          padding: '40px 30px',
          borderRadius: '24px',
          boxShadow: '0 15px 40px rgba(0,0,0,0.2)',
          textAlign: 'center',
          maxWidth: '700px',
          width: '100%',
        }}
      >
        <div style={{ fontSize: '3rem', color: '#d81b60', marginBottom: '10px' }}>
          <FaPills />
        </div>

        <h1 style={{ fontSize: '2.4rem', color: '#d81b60', marginBottom: '10px' }}>
          REMIND-ME-APPLICATION
        </h1>

        <motion.p
          style={{
            fontSize: '1.1rem',
            color: '#333',
            marginBottom: '18px',
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Bienvenue ! Cette application permet aux médicins d'ajouter des prescriptions à leur patients
           qui peuvent à leur tour de suivre leurs prescriptions et recevoivent des rappels automatiques .
        </motion.p>

        <motion.p
          style={{
            fontSize: '1rem',
            color: '#555',
            marginBottom: '28px',
            fontStyle: 'italic',
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          « Un rappel, c'est plus qu'une alerte : c’est une main tendue vers votre santé. »
        </motion.p>

        <motion.button
          whileHover={{ scale: 1.08, boxShadow: '0 8px 25px rgba(216, 27, 96, 0.4)' }}
          whileTap={{ scale: 0.95 }}
          onClick={handleStartClick}
          style={{
            padding: '14px 36px',
            fontSize: '1.1rem',
            background: 'linear-gradient(45deg, #ec407a, #d81b60)',
            color: '#fff',
            border: 'none',
            borderRadius: '40px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          Commencer
        </motion.button>
      </motion.div>
    </div>
  );
};

export default HomePage;
