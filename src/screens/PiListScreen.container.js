import React from 'react';
import { usePis } from '../hooks/usePis';
import { removePi } from '../lib/storage';
import PiListScreenView from '../components/PiListScreen.view';

export default function PiListScreenContainer({ navigation }) {
  const { pis, reachable, refresh } = usePis();

  const handleDelete = async (id) => {
    await removePi(id);
    refresh();
  };

  const handleSelect = (item) =>
    navigation.navigate('PiDashboard', {
      id: item.id,
      hostname: item.name,
      host: item.host,
      username: item.username,
    });

  const handleAdd = () => navigation.navigate('AddPi');

  /* NEW – navigate to AddPi in edit mode */
  const handleEdit = (item) => navigation.navigate('AddPi', { pi: item });

  return (
    <PiListScreenView
      pis={pis}
      reachable={reachable}
      onDelete={handleDelete}
      onSelect={handleSelect}
      onAdd={handleAdd}
      onEdit={handleEdit}   /* NEW */
    />
  );
}
