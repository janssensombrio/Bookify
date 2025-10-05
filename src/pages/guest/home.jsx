import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { database, auth } from '../../config/firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import Navigation from '../../components/nav.jsx';
import Search from '../../components/search.jsx';
import HostCategModal from '../../components/host-categ-modal.jsx';
import './styles/home.css';

export const Home = () => {
  const [isCategModalOpen, setIsCategModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleCategorySelect = async (category) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        alert('You must be logged in first.');
        return;
      }

      const hostsRef = collection(database, 'hosts');
      const q = query(hostsRef, where('uid', '==', user.uid));
      const snapshot = await getDocs(q);

      // Check if user already exists in "hosts"
      if (snapshot.empty) {
        await addDoc(hostsRef, {
          uid: user.uid,
          email: user.email,
          category,
          createdAt: new Date(),
        });
        console.log('Host added successfully!');
      } else {
        console.log('Host already exists, skipping creation.');
      }

      // Redirect to host setup page
      navigate('/host-setup');
    } catch (err) {
      console.error('Error adding host:', err);
      alert('Something went wrong.');
    }
  };


  return (
    <>
      <header>
        <Navigation onOpenHostModal={() => setIsCategModalOpen(true)} />
        <Search />
      </header>

      {isCategModalOpen && (
        <HostCategModal
          onClose={() => setIsCategModalOpen(false)}
          onSelectCategory={handleCategorySelect}
        />
      )}
    </>
  );
};
