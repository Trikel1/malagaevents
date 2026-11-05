import {test,expect,culture} from './fixtures/app';
const venue={id:'33333333-3333-4333-8333-333333333333',name:'Teatro Auditorio Felipe VI',normalized_name:'teatro auditorio felipe vi',city:'Estepona',is_featured:false,venue_type:'theater',status:'active',is_publicly_visible:true,canonical_venue_id:null,former_names:[]};
test('Felipe VI con eventos se puede seleccionar en Teatros sin marcarlo destacado',async({page})=>{
 await page.route('**/rest/v1/venues?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([venue])}));
 await page.route('**/rest/v1/events?**',route=>route.fulfill({contentType:'application/json',headers:{'content-range':'0-0/1'},body:JSON.stringify([{...culture,start_at:'2027-04-24T15:30:00Z',venue_id:venue.id,venue_name:venue.name,venues:venue}])}));
 await page.goto('/events');await page.getByRole('button',{name:'Teatros',exact:true}).click();
 await page.getByPlaceholder('Buscar recinto o ciudad').fill('Felipe');
 const row=page.getByRole('button',{name:/Felipe VI/});await expect(row).toHaveCount(1);await expect(row).toBeEnabled();await row.click();
 const request=page.waitForRequest(req=>new URL(req.url()).pathname.endsWith('/events')&&new URL(req.url()).searchParams.has('venue_id'));
 const apply=page.getByRole('button',{name:'Mostrar 1 recinto',exact:true});await expect(apply).toBeInViewport();await apply.click();
 expect(new URL((await request).url()).searchParams.get('venue_id')).toBe(`in.(${venue.id})`);
 await expect(page.getByRole('heading',{name:culture.title,exact:true}).first()).toBeVisible();
});
