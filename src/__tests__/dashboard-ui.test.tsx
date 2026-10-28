/**
 * MRA FINDER — tableau de bord de référence (maquette MRA-ERP v4.0.8).
 * Verrouille le contenu figé de la copie d'écran : compteurs, panneaux,
 * tuiles de marques, historiques, et le câblage des actions principales.
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import FinderDashboard from '../modules/finder/FinderDashboard'

function renderDashboard() {
  const onSearch = jest.fn()
  const onOpenBrand = jest.fn()
  const onOpenImport = jest.fn()
  const utils = render(
    <FinderDashboard onSearch={onSearch} onOpenBrand={onOpenBrand} onOpenImport={onOpenImport} />,
  )
  return { ...utils, onSearch, onOpenBrand, onOpenImport }
}

describe('MRA FINDER — tableau de bord de référence', () => {
  test('affiche les quatre compteurs exacts de la maquette', () => {
    renderDashboard()
    expect(screen.getAllByText('306').length).toBeGreaterThan(0)
    expect(screen.getAllByText('7').length).toBeGreaterThan(0)
    expect(screen.getAllByText('85').length).toBeGreaterThan(0)
    expect(screen.getAllByText('40').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MODÈLES').length).toBeGreaterThan(0)
    expect(screen.getByText('MARQUES')).toBeTruthy()
    expect(screen.getByText('SCHÉMAS')).toBeTruthy()
    expect(screen.getByText('CONNECTEURS')).toBeTruthy()
  })

  test('reproduit tous les panneaux titrés de la référence', () => {
    renderDashboard()
    for (const title of [
      'RÉPARTITION PAR MARQUE', 'MODÈLES RÉCEMMENT AJOUTÉS',
      'RECHERCHE RAPIDE', 'ACTIONS RAPIDES', 'DERNIÈRES RECHERCHES',
      'TOP RECHERCHES', 'COUVERTURE',
    ]) {
      expect(screen.getByText(title)).toBeTruthy()
    }
    expect(screen.getAllByText('FINDER').length).toBeGreaterThan(0)
  })

  test('la barre latérale a été retirée du tableau de bord', () => {
    const { container } = renderDashboard()
    expect(container.querySelector('.mra-sidebar')).toBeNull()
    expect(container.querySelector('.mra-nav')).toBeNull()
  })

  test('liste les six modèles récemment ajoutés avec leurs dates', () => {
    const { container } = renderDashboard()
    const list = container.querySelector('.mra-recent-list')!
    expect(within(list).getByText('Samsung Galaxy A53')).toBeTruthy()
    expect(within(list).getByText('Xiaomi Redmi Note 10S')).toBeTruthy()
    expect(within(list).getByText('Realme C11 2021')).toBeTruthy()
    expect(within(list).getByText('Oppo A16s')).toBeTruthy()
    expect(within(list).getByText('Infinix Hot 12')).toBeTruthy()
    expect(within(list).getByText('iPhone 11')).toBeTruthy()
    expect(within(list).getByText('2026-10-24 15:42')).toBeTruthy()
  })

  test('affiche les huit tuiles de marques du rail', () => {
    const { container } = renderDashboard()
    const tiles = container.querySelector('.mra-brand-tiles')!
    expect(tiles.querySelectorAll('.mra-brand-tile').length).toBe(8)
    // Quatre tuiles avec libellé sous le logo, comme la maquette
    for (const brand of ['Samsung', 'Xiaomi', 'iPhone', 'Oppo', 'Autres']) {
      expect(within(tiles).getByText(brand)).toBeTruthy()
    }
    // Trois tuiles à mot-symbole centré (sans libellé)
    expect(within(tiles).getByText('realme')).toBeTruthy()
    expect(within(tiles).getByText('Infinix')).toBeTruthy()
    expect(within(tiles).queryByText('Itel')).toBeNull()
  })

  test('un clic sur une tuile de marque ouvre la marque (iPhone → Apple)', () => {
    const { container, onOpenBrand } = renderDashboard()
    const tiles = container.querySelector('.mra-brand-tiles')!
    fireEvent.click(within(tiles).getByText('Samsung'))
    expect(onOpenBrand).toHaveBeenCalledWith('Samsung')
    fireEvent.click(within(tiles).getByText('iPhone'))
    expect(onOpenBrand).toHaveBeenCalledWith('Apple')
  })

  test('un clic sur une recherche historique relance la recherche', () => {
    const { onSearch } = renderDashboard()
    fireEvent.click(screen.getByText('Redmi Note 10S PMIC'))
    expect(onSearch).toHaveBeenCalledWith('Redmi Note 10S PMIC')
    fireEvent.click(screen.getByText('Samsung A53 schéma'))
    expect(onSearch).toHaveBeenCalledWith('Samsung A53 schéma')
  })

  test("l'onglet Par Photo annonce l'indisponibilité sans résultat simulé", () => {
    renderDashboard()
    fireEvent.click(screen.getByText('Par Photo'))
    expect(screen.getByText('Recherche par photo indisponible sur ce poste.')).toBeTruthy()
  })

  test('le champ de recherche rapide filtre les tuiles de marques', () => {
    const { container } = renderDashboard()
    const tiles = container.querySelector('.mra-brand-tiles')!
    fireEvent.change(screen.getByLabelText('Recherche rapide'), { target: { value: 'oppo' } })
    expect(within(tiles).getByText('Oppo')).toBeTruthy()
    expect(within(tiles).queryByText('Samsung')).toBeNull()
  })

  test('le top 5 des recherches affiche les compteurs de la référence', () => {
    renderDashboard()
    expect(screen.getByText('Redmi Note 10S')).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
    expect(screen.getByText('37')).toBeTruthy()
    expect(screen.getByText('24')).toBeTruthy()
  })

  test('Ajouter un modèle ouvre le panneau d’import', () => {
    const { onOpenImport } = renderDashboard()
    fireEvent.click(screen.getByText('Ajouter un modèle'))
    expect(onOpenImport).toHaveBeenCalled()
  })

  test('la barre d’état reproduit les informations de version et de base', () => {
    renderDashboard()
    expect(screen.getByText('MRA-ERP v4.0.8')).toBeTruthy()
    expect(screen.getByText('Finder Module')).toBeTruthy()
    expect(screen.getByText('DB: mra-erp.db')).toBeTruthy()
    expect(screen.getByText('Système local')).toBeTruthy()
  })
})
