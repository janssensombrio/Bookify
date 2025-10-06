import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from '../../components/nav.jsx';
import Search from '../../components/search.jsx';
import HostCategModal from '../../components/host-categ-modal.jsx';
import './styles/home.css';

export const Home = () => {
  const [showHostModal, setShowHostModal] = useState(false);
  const navigate = useNavigate();

  const handleOpenHostModal = () => setShowHostModal(true);
  const handleCloseHostModal = () => setShowHostModal(false);

  const handleSelectCategory = (category) => {
    setShowHostModal(false);
    if (category === "Homes") {
      navigate('/host-set-up', { state: { category } });
    } else if (category === "Experiences") {
      navigate('/host-set-up-2', { state: { category } });
    } else if (category === "Services") {
      navigate('/host-set-up-3', { state: { category } }); // if you have a services page
    }
  };

  return (
    <>
      <header>
        <Navigation onOpenHostModal={handleOpenHostModal} />
        <Search />
      </header>

      {showHostModal && (
        <HostCategModal
          onClose={handleCloseHostModal}
          onSelectCategory={handleSelectCategory}
        />
      )}
    </>
  );
};
