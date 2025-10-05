import { useState } from 'react';
import Navigation from '../../components/nav.jsx';
import Search from '../../components/search.jsx';
import HostCategModal from '../../components/host-categ-modal.jsx';
import HostSignUpModal from '../../components/host-signup-modal.jsx';

import './styles/home.css';

export const Home = () => {
  const [isCategModalOpen, setIsCategModalOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);
  const [selectedCateg, setSelectedCateg] = useState(null);

  const openSignUpModal = (categ) => {
    setSelectedCateg(categ);
    setIsCategModalOpen(false);
    setIsSignUpModalOpen(true);
  };

  return (
    <>
      <header>
        {/* Pass function to open modal */}
        <Navigation onOpenHostModal={() => setIsCategModalOpen(true)} />
        <Search />
      </header>

       {isCategModalOpen && <HostCategModal onClose={() => setIsCategModalOpen(false)} onSelectCategory={openSignUpModal} />}
      {isSignUpModalOpen && <HostSignUpModal category={selectedCateg} onClose={() => setIsSignUpModalOpen(false)} />}
    </>
  );
};
