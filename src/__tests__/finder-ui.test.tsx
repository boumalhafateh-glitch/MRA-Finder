/**
 * MRA FINDER — écran réel.
 *
 * Ces tests verrouillent trois promesses visibles :
 * - les trois modes de recherche sont proposés, dont un mode photo annoncé
 *   indisponible (aucun résultat simulé) ;
 * - les compteurs affichés sont ceux que renvoie le pont, jamais des valeurs
 *   écrites dans le composant ;
 * - une absence de donnée s'affiche comme une absence, avec une porte de sortie.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../contexts/LanguageContext'
import FinderModule from '../modules/finder/FinderModule'
import fr from '../locales/fr.json'
import en from '../locales/en.json'
import ar from '../locales/ar.json'

const stats = {
  brands: 38,
  devices: 306,
  device_aliases: 278,
  categories: 86,
  parts: 0,
  part_refs: 0,
  compatibilities: 0,
  compatibilities_by_status: {},
  ics: 0,
  ic_equivalences: 0,
  ic_devices: 0,
  media: 0,
  import_batches: 0,
  last_import: null,
  devices_without_model_ref: 306,
  devices_without_year: 0,
  devices_without_image: 306,
}

const brands = [
  { id: 1, name: 'Samsung', slug: 'samsung', logo_path: '', device_count: 47 },
  { id: 2, name: 'Tecno', slug: 'tecno', logo_path: '', device_count: 49 },
]

function installApi(overrides: Partial<Record<string, unknown>> = {}) {
  const finder = {
    stats: jest.fn(async () => ({ ok: true, stats })),
    brands: jest.fn(async () => ({ ok: true, result: { total: 2, page: 1, pageSize: 200, items: brands } })),
    search: jest.fn(async () => ({
      ok: true,
      result: { total: 0, page: 1, pageSize: 20, items: [], mode: 'tokens' },
    })),
    brand: jest.fn(async () => ({ ok: true, brand: brands[0] })),
    devices: jest.fn(async () => ({ ok: true, result: { total: 0, page: 1, pageSize: 200, items: [] } })),
    device: jest.fn(async () => ({ ok: false, error: 'NOT_FOUND' })),
    part: jest.fn(async () => ({ ok: true, part: null })),
    importParts: jest.fn(async () => ({ ok: true, batchId: 1, status: 'ok' as const, inserted: 1, updated: 0, skipped: 0, rejected: 0, devicesEnriched: 0, rejectedRows: [] })),
    ...overrides,
  }
  Object.defineProperty(window, 'api', {
    value: { finder },
    configurable: true,
    writable: true,
  })
  return finder
}

function renderModule() {
  return render(
    <LanguageProvider>
      <FinderModule />
    </LanguageProvider>,
  )
}

describe('MRA FINDER — écran', () => {
  test('les trois modes de recherche sont visibles', async () => {
    installApi()
    renderModule()
    expect(await screen.findByText(fr.finder.mode.part)).toBeTruthy()
    expect(screen.getByText(fr.finder.mode.device)).toBeTruthy()
    expect(screen.getByText(fr.finder.mode.photo)).toBeTruthy()
  })

  test('les compteurs affichés viennent du pont, pas du composant', async () => {
    installApi()
    renderModule()
    await waitFor(() => expect(screen.getByText('306')).toBeTruthy())
    expect(screen.getByText('38')).toBeTruthy()
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(2)
  })

  test('le mode photo annonce l’indisponibilité et ne lance aucune recherche', async () => {
    const finder = installApi()
    renderModule()
    fireEvent.click(await screen.findByText(fr.finder.mode.photo))
    expect(screen.getByText(fr.finder.photo.unavailable)).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: fr.finder.search.action })).toBeNull()
    expect(finder.search).not.toHaveBeenCalled()
  })

  test('une recherche de pièce vide ne fabrique pas de résultat', async () => {
    const finder = installApi()
    renderModule()
    fireEvent.click(await screen.findByText(fr.finder.search.action))
    expect(await screen.findByText(fr.finder.search.empty_query)).toBeTruthy()
    expect(finder.search).not.toHaveBeenCalled()
  })

  test('aucune pièce documentée : le message est dit et l’appareil reste accessible', async () => {
    const finder = installApi()
    renderModule()
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'SM-A125F' } })
    fireEvent.click(screen.getByText(fr.finder.search.action))
    expect(await screen.findByText(fr.finder.search.no_part_yet)).toBeTruthy()
    expect(finder.search).toHaveBeenCalledWith(expect.objectContaining({ q: 'SM-A125F', kind: 'part' }))
    expect(screen.getByText(fr.finder.search.try_device)).toBeTruthy()
  })

  test('une recherche appareil affiche le modèle réel renvoyé', async () => {
    const finder = installApi({
      search: jest.fn(async () => ({
        ok: true,
        result: {
          total: 1,
          page: 1,
          pageSize: 20,
          mode: 'tokens',
          items: [
            {
              kind: 'device',
              id: 12,
              title: 'Galaxy A18 4G',
              device: {
                id: 12,
                commercial_name: 'Galaxy A18 4G',
                model_ref: '',
                release_year: 2026,
                image_path: '',
                brand_name: 'Samsung',
                brand_id: 1,
              },
            },
          ],
        },
      })),
    })
    renderModule()
    fireEvent.click(await screen.findByText(fr.finder.mode.device))
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'galaxy a18' } })
    fireEvent.click(screen.getByText(fr.finder.search.action))
    expect(await screen.findByText('Galaxy A18 4G')).toBeTruthy()
    expect(finder.search).toHaveBeenCalledWith(expect.objectContaining({ kind: 'device' }))
  })

  test('pont absent : le module le dit au lieu d’afficher des chiffres', async () => {
    installApi({
      stats: jest.fn(async () => ({ ok: false, error: 'NO_DESKTOP_BRIDGE' })),
      brands: jest.fn(async () => ({ ok: false, error: 'NO_DESKTOP_BRIDGE' })),
    })
    renderModule()
    expect(await screen.findByText(fr.finder.error.unavailable)).toBeTruthy()
    expect(screen.queryByText('306')).toBeNull()
  })

  test('le panneau d’import annonce la règle des statuts et propose le modèle CSV', async () => {
    installApi()
    renderModule()
    fireEvent.click(await screen.findByText(fr.finder.import.open))
    expect(screen.getByText(fr.finder.import.note)).toBeTruthy()
    expect(screen.getByText(fr.finder.import.template)).toBeTruthy()
    expect(screen.getByLabelText(fr.finder.import.placeholder)).toBeTruthy()
  })

  test('un import accepté affiche les compteurs réels du rapport', async () => {
    const finder = installApi()
    renderModule()
    fireEvent.click(await screen.findByText(fr.finder.import.open))
    fireEvent.change(screen.getByLabelText(fr.finder.import.placeholder), {
      target: { value: 'category;brand;model;part_name\nbattery;Samsung;Galaxy A18 4G;Batterie' },
    })
    fireEvent.click(screen.getByText(fr.finder.import.action))
    await waitFor(() => expect(finder.importParts).toHaveBeenCalled())
    expect(finder.importParts).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'csv', content: expect.stringContaining('battery;Samsung') }),
    )
    expect(
      await screen.findByText(
        fr.finder.import.done
          .replace('{inserted}', '1')
          .replace('{updated}', '0')
          .replace('{skipped}', '0')
          .replace('{rejected}', '0'),
      ),
    ).toBeTruthy()
  })

  test('un import refusé nomme la raison au lieu de faire croire au succès', async () => {
    installApi({
      importParts: jest.fn(async () => ({
        ok: true,
        batchId: 2,
        status: 'failed' as const,
        inserted: 0,
        updated: 0,
        skipped: 0,
        rejected: 1,
        devicesEnriched: 0,
        rejectedRows: [{ line: 2, reason: 'STATUS_REQUIRES_EVIDENCE', detail: '' }],
      })),
    })
    renderModule()
    fireEvent.click(await screen.findByText(fr.finder.import.open))
    fireEvent.change(screen.getByLabelText(fr.finder.import.placeholder), { target: { value: 'x' } })
    fireEvent.click(screen.getByText(fr.finder.import.action))
    expect(await screen.findByText(fr.finder.import.reason.STATUS_REQUIRES_EVIDENCE)).toBeTruthy()
  })

  test('une pièce trouvée s’ouvre sur sa fiche et montre ses appareils', async () => {
    const finder = installApi({
      search: jest.fn(async () => ({
        ok: true,
        result: {
          total: 1,
          page: 1,
          pageSize: 20,
          mode: 'tokens',
          items: [
            {
              kind: 'part',
              id: 44,
              title: 'Batterie d’origine',
              part: {
                id: 44,
                name: 'Batterie d’origine',
                oem_ref: 'EB-IMPORT-001',
                part_type: 'battery',
                confidence: 'declared',
                category_name: 'Batteries',
                category_slug: 'battery',
              },
            },
          ],
        },
      })),
      part: jest.fn(async () => ({
        ok: true,
        part: {
          id: 44,
          category_id: 3,
          category_name: 'Batteries',
          category_slug: 'battery',
          name: 'Batterie d’origine',
          part_type: 'battery',
          oem_ref: 'EB-IMPORT-001',
          notes: '',
          confidence: 'declared',
          created_at: '',
          updated_at: '',
          refs: [{ kind: 'oem', value: 'EB-IMPORT-001', is_primary: 1 }],
          devices: [
            { id: 1, commercial_name: 'Galaxy A18 4G', model_ref: '', release_year: 2026, brand_name: 'Samsung', role: 'oem' },
          ],
          compatibilities: [],
          media: [],
        },
      })),
    })
    renderModule()
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'batterie' } })
    fireEvent.click(screen.getByText(fr.finder.search.action))
    fireEvent.click(await screen.findByText('Batterie d’origine'))
    await waitFor(() => expect(finder.part).toHaveBeenCalledWith(44))
    expect(await screen.findByText(fr.finder.part.devices)).toBeTruthy()
    expect(screen.getByText('Galaxy A18 4G')).toBeTruthy()
    expect(screen.getByText(fr.finder.part.compat_empty)).toBeTruthy()
  })

  // ——— Réponses asynchrones : seule la demande la plus récente compte ———

  const deviceA = {
    id: 12,
    brand_id: 1,
    brand_name: 'Samsung',
    commercial_name: 'Galaxy A18 4G',
    model_ref: 'SM-A185F',
    release_year: 2026,
    image_path: '',
    aliases: [],
    missing: [],
    parts: [
      { id: 7, name: 'Batterie EB-BA185ABY', category_name: 'Batteries', oem_ref: 'EB-BA185ABY', confidence: 'declared' },
    ],
    compatibilities: [],
    ics: [],
  }

  const partHit = {
    kind: 'part',
    id: 44,
    title: 'Batterie d’origine',
    part: {
      id: 44,
      name: 'Batterie d’origine',
      oem_ref: 'EB-IMPORT-001',
      part_type: 'battery',
      confidence: 'declared',
      category_name: 'Batteries',
      category_slug: 'battery',
    },
  }

  const partSheet = {
    id: 44,
    category_id: 3,
    category_name: 'Batteries',
    category_slug: 'battery',
    name: 'Batterie d’origine',
    part_type: 'battery',
    oem_ref: 'EB-IMPORT-001',
    notes: '',
    confidence: 'declared',
    created_at: '',
    updated_at: '',
    refs: [{ kind: 'oem', value: 'EB-IMPORT-001', is_primary: 1 }],
    devices: [
      { id: 1, commercial_name: 'Galaxy A18 4G', model_ref: '', release_year: 2026, brand_name: 'Samsung', role: 'oem' },
    ],
    compatibilities: [],
    media: [],
  }

  const searchWithPart = jest.fn(async () => ({
    ok: true,
    result: { total: 1, page: 1, pageSize: 20, mode: 'tokens', items: [partHit] },
  }))

  const partOk = jest.fn(async () => ({ ok: true, part: partSheet }))

  async function openPartSheet() {
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'batterie' } })
    fireEvent.click(screen.getByText(fr.finder.search.action))
    fireEvent.click(await screen.findByText('Batterie d’origine'))
    await screen.findByText(fr.finder.part.devices)
  }

  test('ouvrir la fiche appareil ferme la fiche pièce ouverte', async () => {
    installApi({
      search: searchWithPart,
      part: partOk,
      device: jest.fn(async () => ({ ok: true, device: deviceA })),
    })
    renderModule()
    await openPartSheet()
    fireEvent.click(screen.getByText('Galaxy A18 4G'))
    expect(await screen.findByText(fr.finder.device.parts)).toBeTruthy()
    expect(screen.queryByText(fr.finder.part.compat_empty)).toBeNull()
    expect(screen.queryByText(fr.finder.part.refs)).toBeNull()
  })

  test('« Annuler » fait taire la réponse qui n’arrive que plus tard', async () => {
    let resolveDevice: (value: { ok: boolean; device: typeof deviceA }) => void = () => undefined
    const pending = new Promise<{ ok: boolean; device: typeof deviceA }>((resolve) => {
      resolveDevice = resolve
    })
    const finder = installApi({
      search: searchWithPart,
      part: partOk,
      device: jest.fn(() => pending),
    })
    renderModule()
    await openPartSheet()
    fireEvent.click(screen.getByText('Galaxy A18 4G'))
    expect(await screen.findByText(fr.finder.action.cancel)).toBeTruthy()
    fireEvent.click(screen.getByText(fr.finder.action.cancel))
    expect(screen.queryByText(fr.finder.action.cancel)).toBeNull()
    await act(async () => {
      resolveDevice({ ok: true, device: deviceA })
    })
    expect(finder.device).toHaveBeenCalledWith(1)
    expect(screen.queryByText(fr.finder.device.parts)).toBeNull()
  })

  test('une marque lente ne remplace pas la marque ouverte après elle', async () => {
    let resolveSlow: (value: unknown) => void = () => undefined
    const slow = new Promise((resolve) => {
      resolveSlow = resolve
    })
    const devices = jest
      .fn()
      .mockImplementationOnce(() => slow)
      .mockImplementationOnce(async () => ({
        ok: true,
        result: {
          total: 1,
          page: 1,
          pageSize: 200,
          items: [{ id: 2, commercial_name: 'Modèle récent B', model_ref: 'B-1', release_year: 2026 }],
        },
      }))
    installApi({ devices })
    renderModule()
    fireEvent.click(await screen.findByText('Samsung'))
    expect(await screen.findByText(fr.finder.device.loading)).toBeTruthy()
    fireEvent.click(screen.getByText(fr.finder.action.home))
    fireEvent.click(await screen.findByText('Tecno'))
    expect(await screen.findByText('Modèle récent B')).toBeTruthy()
    await act(async () => {
      resolveSlow({
        ok: true,
        result: {
          total: 1,
          page: 1,
          pageSize: 200,
          items: [{ id: 1, commercial_name: 'Modèle ancien A', model_ref: 'A-1', release_year: 2019 }],
        },
      })
    })
    expect(screen.queryByText('Modèle ancien A')).toBeNull()
    expect(screen.getByText('Modèle récent B')).toBeTruthy()
  })

  test('une marque en échec affiche une erreur réessayable, pas « aucun appareil »', async () => {
    installApi({ devices: jest.fn(async () => ({ ok: false, error: 'BOOM' })) })
    renderModule()
    fireEvent.click(await screen.findByText('Samsung'))
    expect(await screen.findByText(fr.finder.error.search)).toBeTruthy()
    expect(screen.queryByText(fr.finder.brands.empty)).toBeNull()
    expect(screen.getByText(fr.finder.action.retry)).toBeTruthy()
  })

  test('une erreur de statistiques se réessaie depuis son bandeau', async () => {
    const statsMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'BOOM' })
      .mockResolvedValueOnce({ ok: true, stats })
    installApi({ stats: statsMock })
    renderModule()
    await screen.findByText(fr.finder.error.unavailable)
    fireEvent.click(screen.getByText(fr.finder.action.retry))
    await waitFor(() => expect(screen.getByText('306')).toBeTruthy())
    expect(screen.queryByText(fr.finder.error.unavailable)).toBeNull()
  })

  test('Réessayer et Annuler existent en FR, EN et AR', () => {
    for (const dict of [fr, en, ar]) {
      expect(typeof dict.finder.action.retry).toBe('string')
      expect(dict.finder.action.retry.length).toBeGreaterThan(0)
      expect(typeof dict.finder.action.cancel).toBe('string')
      expect(dict.finder.action.cancel.length).toBeGreaterThan(0)
    }
  })
})
