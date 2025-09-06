import SimpleTabletop from '../components/SimpleTabletop';
import { useState } from 'react';

const Index = () => {
  const [showTokenPanel, setShowTokenPanel] = useState(false);
  const [showMapControls, setShowMapControls] = useState(false);
  const [showBackgroundGrid, setShowBackgroundGrid] = useState(false);
  const [showGridControls, setShowGridControls] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [showLayerStack, setShowLayerStack] = useState(false);

  return (
    <SimpleTabletop 
      onOpenTokenPanel={() => setShowTokenPanel(true)}
      onOpenMapControls={() => setShowMapControls(true)} 
      onOpenBackgroundGrid={() => setShowBackgroundGrid(true)}
      onOpenGridControls={() => setShowGridControls(true)}
      onOpenVisibilityModal={() => setShowVisibilityModal(true)}
      onOpenLayerStack={() => setShowLayerStack(true)}
    />
  );
};

export default Index;
