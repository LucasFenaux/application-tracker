import { getPrompts, getSettings, getAllMaterials } from '@/app/actions';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const prompts = await getPrompts();
  const settings = await getSettings();
  const materials = await getAllMaterials();
  
  return (
    <main>
      <SettingsClient prompts={prompts} settings={settings} materials={materials} />
    </main>
  );
}
