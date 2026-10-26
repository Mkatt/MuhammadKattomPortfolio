(() => {
  const dialog = document.getElementById('project-dialog');
  const content = document.getElementById('dialog-body');
  const close = document.getElementById('close-project');
  const contextLabel = document.getElementById('dialog-context');
  const pathCache = new Map();
  let activeProject = null;
  let reader = null;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const previews = {
    catalan: ['assets/catalan-poster.pdf', 1],
    grammar: ['assets/grammar-encoding.pdf', 2],
    'frank-wolfe': ['assets/frank-wolfe-review.pdf', 3]
  };

  // Relative paths work both locally and under the GitHub Pages repository URL.
  function assetURL(path) { return path; }

  function showDialog() {
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
    dialog.scrollTop = 0;
  }

  function connectAssets(scope) {
    scope.querySelectorAll('a[href^="assets/"]').forEach(link => {
      const path = link.getAttribute('href');
      link.href = assetURL(path);
      link.removeAttribute('download');
      if (path.endsWith('.pdf')) {
        link.setAttribute('aria-haspopup','dialog');
        link.addEventListener('click', event => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          openDocument(path);
        });
      } else {
        link.addEventListener('click', event => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          openImage(path, link.textContent);
        });
      }
    });
    scope.querySelectorAll('img[data-asset]').forEach(img => { img.src = assetURL(img.dataset.asset); });
    scope.querySelectorAll('[data-document]').forEach(button => button.addEventListener('click', () => openDocument(button.dataset.document, Number(button.dataset.page || 1))));
    scope.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => openImage(button.dataset.image, button.dataset.label || 'Project image')));
  }

  function dyckPaths(n) {
    if (pathCache.has(n)) return pathCache.get(n);
    const paths=[];
    function walk(x,y,path) {
      if(x===n && y===n){paths.push(path);return;}
      if(y<n) walk(x,y+1,path+'N');
      if(x<y) walk(x+1,y,path+'E');
    }
    walk(0,0,'');pathCache.set(n,paths);return paths;
  }

  function dyckGraphic(n, path) {
    const left=92, top=20, size=220, step=size/n;
    let grid='';
    for(let i=0;i<=n;i++)grid+=`<path d="M${left+i*step} ${top}V${top+size}M${left} ${top+i*step}H${left+size}" stroke="#d9e0e7" stroke-width="1"/>`;
    let x=0,y=0,points=`${left},${top+size}`;
    for(const move of path){if(move==='N')y++;else x++;points+=` ${left+x*step},${top+size-y*step}`;}
    return `<svg viewBox="0 0 410 270" role="img" aria-label="A Dyck path on a ${n} by ${n} grid" style="font-family:Arial,sans-serif;font-size:15px"><title>North and east steps staying above the diagonal</title>${grid}<path d="M${left} ${top+size}L${left+size} ${top}" fill="none" stroke="#9aa5ae" stroke-dasharray="5 5"/><polyline points="${points}" fill="none" stroke="#18569c" stroke-width="4" stroke-linejoin="round"/><circle cx="${left}" cy="${top+size}" r="4" fill="#18569c"/><circle cx="${left+size}" cy="${top}" r="4" fill="#18569c"/><text x="${left-17}" y="${top+size+20}" fill="#595959">0</text><text x="${left+size-3}" y="${top+size+20}" fill="#595959">${n}</text><text x="${left-20}" y="${top+5}" fill="#595959">${n}</text></svg>`;
  }

  function dyckExplorer() {
    return `<section class="dyck-panel" aria-label="Dyck path explorer"><h3>Dyck paths</h3><div id="dyck-picture"></div><div class="dyck-controls"><label for="dyck-size">Grid size: <span id="dyck-size-label">5</span></label><input id="dyck-size" type="range" min="2" max="6" value="5"><button id="next-path" type="button">Next path</button><output id="path-status" aria-live="polite"></output></div><p class="context">North and east steps that stay on or above the diagonal.</p></section>`;
  }

  function initDyck() {
    const slider=document.getElementById('dyck-size');
    if(!slider)return;
    let index=0;
    function draw(){const n=Number(slider.value),paths=dyckPaths(n);document.getElementById('dyck-picture').innerHTML=dyckGraphic(n,paths[index]);document.getElementById('dyck-size-label').textContent=n;document.getElementById('path-status').textContent=`Path ${index+1} of ${paths.length}`;}
    slider.addEventListener('input',()=>{index=0;draw();});
    document.getElementById('next-path').addEventListener('click',()=>{index=(index+1)%dyckPaths(Number(slider.value)).length;draw();});
    draw();
  }

  function chartSVG(values, settings) {
    const x=i=>58+i*584/(values.length-1),y=v=>225-v*184/settings.max;
    const grid=settings.ticks.map(v=>`<line x1="58" x2="642" y1="${y(v)}" y2="${y(v)}" stroke="#e2e2e2"/><text x="48" y="${y(v)+5}" text-anchor="end">${v.toLocaleString('en-US')}</text>`).join('');
    const labels=settings.labels.map(([i,label])=>`<text x="${x(i)}" y="248" text-anchor="middle">${esc(label)}</text>`).join('');
    const series=settings.dots?values.map((v,i)=>`<circle cx="${x(i).toFixed(2)}" cy="${y(v).toFixed(2)}" r="2.8" fill="#18569c"><title>Instance ${i+1}: ${v.toFixed(3)}</title></circle>`).join(''):`<polyline points="${values.map((v,i)=>`${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')}" fill="none" stroke="#18569c" stroke-width="1.8"/>`;
    return `<svg class="result-chart" viewBox="0 0 660 276" role="img" aria-label="${esc(settings.title)}" style="font-family:Arial,sans-serif;font-size:14px;fill:#595959"><title>${esc(settings.title)}</title><text x="58" y="21">${esc(settings.yLabel)}</text>${grid}${series}${labels}<text x="350" y="271" text-anchor="middle">${esc(settings.xLabel)}</text></svg>`;
  }

  function resultsGraphic(id) {
    if(id==='optimization')return chartSVG(window.PROJECT_RESULTS.optimization.objective,{max:16,ticks:[0,4,8,12,16],labels:[[0,'1'],[24,'25'],[49,'50'],[74,'75'],[99,'100']],dots:true,title:'Final objective for 100 optimization instances',yLabel:'Final objective',xLabel:'Instance'});
    if(id==='analytics'){
      const values=window.PROJECT_RESULTS.engagement.map(row=>row.users),max=Math.ceil(Math.max(...values)/1000)*1000;
      return chartSVG(values,{max,ticks:[0,max/4,max/2,3*max/4,max],labels:[[0,'Jan'],[91,'Apr'],[182,'Jul'],[274,'Oct'],[365,'Dec']],title:'Daily active users during 2016',yLabel:'Daily active users',xLabel:'2016'});
    }
    const values=[['Naive Bayes',82],['Logistic regression',84.75],['Linear SVC',85.75],['Random forest',80.5],['Filtered logistic regression',85.25]];
    return `<svg class="result-chart" viewBox="0 0 680 300" role="img" aria-label="Classifier accuracies on held-out movie reviews" style="font-family:Arial,sans-serif;font-size:15px;fill:#444"><title>Classifier accuracy on 400 held-out reviews</title>${[0,25,50,75,100].map(v=>`<line x1="${230+v*3.7}" x2="${230+v*3.7}" y1="15" y2="255" stroke="#e2e2e2"/><text x="${230+v*3.7}" y="280" text-anchor="middle">${v}%</text>`).join('')}${values.map(([label,v],i)=>`<text x="215" y="${45+i*47}" text-anchor="end">${esc(label)}</text><rect x="230" y="${25+i*47}" width="${v*3.7}" height="28" fill="#18569c"/><text x="${238+v*3.7}" y="${45+i*47}">${v.toFixed(2)}%</text>`).join('')}</svg>`;
  }

  function diagram(id) {
    const box=(x,y,w,label)=>`<rect x="${x}" y="${y}" width="${w}" height="54" rx="3" fill="#fff" stroke="#8094a6"/><text x="${x+w/2}" y="${y+32}" text-anchor="middle">${label}</text>`;
    const start='<svg viewBox="0 0 680 320" role="img" style="font-family:Arial,sans-serif;font-size:17px;fill:#273c4e">';
    if(id==='forecasting')return start+'<title>Forecasting pipeline: Prophet predicts daily totals, XGBoost estimates interval shares, and their outputs combine</title><path d="M180 77H245M180 222H245M435 77H475V149H495M435 222H475V176H495" fill="none" stroke="#8194a6" stroke-width="2"/>'+box(15,50,165,'Daily history')+box(245,50,190,'Prophet: daily total')+box(15,195,165,'Interval history')+box(245,195,190,'XGBoost: shares')+box(495,135,170,'Interval forecast')+'</svg>';
    if(id==='labyrinth')return start+'<title>Room connections between the entrance, archive, workshop, and sealed chamber</title><path d="M210 145L270 72M210 160L270 240M440 72H485" fill="none" stroke="#8194a6" stroke-width="2"/>'+box(40,125,170,'Entrance')+box(270,45,170,'Archive')+box(270,215,190,'Alchemy workshop')+box(485,45,175,'Sealed chamber')+'</svg>';
    const subs=['₁','₂','₃','₄'];let cells='';
    for(let row=0;row<4;row++)for(let col=0;col<4;col++)cells+=`<rect x="${30+col*65}" y="${20+row*65}" width="65" height="65" fill="#fff" stroke="#a8b5c0"/><text x="${62.5+col*65}" y="${59+row*65}" text-anchor="middle">x${subs[row]}${subs[col]}</text>`;
    return start+'<title>Sixteen integer variables with bounded values and row and column uniqueness constraints</title>'+cells+'<text x="340" y="104">Values from 1 to 4</text><text x="340" y="147">Distinct within each row</text><text x="340" y="190">Distinct within each column</text></svg>';
  }

  function documentPreview(path,page) {
    const doc=window.PORTFOLIO_DOCUMENTS[path],item=doc.pages[page-1];
    return `<figure class="project-output document-preview"><button type="button" class="image-button" data-document="${esc(path)}" data-page="${page}" aria-label="Read ${esc(doc.title)}"><img data-asset="${esc(item.image)}" width="${item.width}" height="${item.height}" alt="${esc(doc.title)}, page ${page}" loading="lazy"></button><figcaption>${esc(doc.title)}${doc.pages.length>1?`, page ${page}`:''}. Select the preview to read it.</figcaption></figure>`;
  }

  function projectOutput(project) {
    const id=project.id;
    if(id==='catalan')return dyckExplorer();
    if(id==='mosaic')return `<div class="project-output mosaic-pair">${[['assets/mosaic-source.webp','Source image',378,662],['assets/mosaic.webp','Photomosaic output',914,1600]].map(([path,label,w,h])=>`<figure><button class="image-button" type="button" data-image="${path}" data-label="${label}" aria-label="Enlarge ${label.toLowerCase()}"><img data-asset="${path}" width="${w}" height="${h}" alt="${label}"></button><figcaption>${label}</figcaption></figure>`).join('')}</div>`;
    if(['optimization','analytics','sentiment'].includes(id))return `<figure class="project-output"><div class="chart-scroll">${resultsGraphic(id)}</div><figcaption>${id==='optimization'?'Each point is a different random instance from the saved experiment.':id==='analytics'?'Distinct active accounts per day in the supplied sample database.':'Saved notebook results on 400 held-out reviews. The written report records a separate run.'}</figcaption></figure>`;
    if(previews[id])return documentPreview(...previews[id]);
    if(id==='bookmarker')return `<figure class="project-output"><button class="image-button" type="button" data-image="assets/bookmarker-diagram.webp" data-label="Bookmarker database design" aria-label="Enlarge the database diagram"><img data-asset="assets/bookmarker-diagram.webp" alt="The team's entity-relationship diagram connecting books, authors, users, publishers, words, and genres" width="1120" height="505"></button><figcaption>Database design from the team report. Some proposed features were not included in the final application.</figcaption></figure>`;
    return `<figure class="project-output">${diagram(id)}<figcaption>${id==='forecasting'?'Daily totals and intraday shares are combined into the interval forecast.':id==='labyrinth'?'Connections between rooms in the implemented game domain.':'The grid variables and their base constraints. The program adds visibility and cipher constraints.'}</figcaption></figure>`;
  }

  function cardGraphic(project) {
    if(project.id==='catalan')return dyckGraphic(5,dyckPaths(5)[12]);
    if(project.id==='mosaic')return '<img data-asset="assets/mosaic.webp" alt="Photomosaic output" class="preview-image">';
    if(['optimization','analytics','sentiment'].includes(project.id))return resultsGraphic(project.id);
    if(previews[project.id]){const [path,page]=previews[project.id];return `<img data-asset="${window.PORTFOLIO_DOCUMENTS[path].pages[page-1].image}" class="preview-image preview-document" alt="${esc(project.title)} report preview">`;}
    if(project.id==='bookmarker')return '<img data-asset="assets/bookmarker-diagram.webp" class="preview-image preview-diagram" alt="Bookmarker database diagram">';
    return diagram(project.id);
  }

  function grammarSource() {
    return `<details class="grammar-source"><summary>View the ACG source</summary><label for="grammar-file">File</label><select id="grammar-file">${window.PORTFOLIO_GRAMMARS.map((file,index)=>`<option value="${index}">${esc(file.name)}</option>`).join('')}</select><pre><code id="grammar-code"></code></pre></details>`;
  }

  function initGrammarSource() {
    const select=document.getElementById('grammar-file');if(!select)return;
    const display=()=>{document.getElementById('grammar-code').textContent=window.PORTFOLIO_GRAMMARS[Number(select.value)].source;};
    select.addEventListener('change',display);display();
  }

  function openProject(id) {
    const project=window.PROJECTS.find(item=>item.id===id);if(!project)return;
    activeProject=id;reader=null;dialog.classList.remove('document-mode');contextLabel.textContent='Project';
    const links=project.links.length?`<p class="links">${project.links.map(([label,path])=>`<a href="${esc(path)}">${esc(label)}</a>`).join(' &middot; ')}</p>`:'';
    content.innerHTML=`<h2 id="dialog-title" tabindex="-1">${esc(project.title)}</h2><p class="context">${esc(project.context)}</p>${projectOutput(project)}${project.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}${id==='catalan'?documentPreview(...previews.catalan):''}${id==='grammar'?grammarSource():''}${links}`;
    connectAssets(content);showDialog();if(id==='catalan')initDyck();if(id==='grammar')initGrammarSource();
  }

  function openDocument(path,page=1) {
    const doc=window.PORTFOLIO_DOCUMENTS[path];if(!doc)return;
    if(!activeProject)activeProject=window.PROJECTS.find(p=>p.links.some(link=>link[1]===path))?.id||null;
    reader={path,doc,page:Math.max(0,Math.min(page-1,doc.pages.length-1)),zoom:1};
    dialog.classList.add('document-mode');contextLabel.textContent='PDF';
    content.innerHTML=`<button class="back-button" type="button" id="back-project">${activeProject?'Back to project':'Back to projects'}</button><h2 id="dialog-title">${esc(doc.title)}</h2><div class="reader-controls"><div><button type="button" id="previous-page">Previous</button><span id="page-status" aria-live="polite"></span><button type="button" id="next-page">Next</button></div><div><button type="button" id="zoom-out" aria-label="Zoom out">−</button><button type="button" id="fit-page">Fit width</button><button type="button" id="zoom-in" aria-label="Zoom in">+</button></div><a href="${esc(assetURL(path))}" target="_blank" rel="noopener" type="application/pdf">Open PDF in new tab</a></div><div class="document-stage" id="document-stage" tabindex="0" aria-label="PDF page"><img id="document-page" alt=""></div>`;
    document.getElementById('back-project').addEventListener('click',backToProject);
    document.getElementById('previous-page').addEventListener('click',()=>{if(reader.page>0){reader.page--;drawDocument();}});
    document.getElementById('next-page').addEventListener('click',()=>{if(reader.page<reader.doc.pages.length-1){reader.page++;drawDocument();}});
    document.getElementById('zoom-out').addEventListener('click',()=>{reader.zoom=Math.max(1,reader.zoom-.25);drawDocument(false);});
    document.getElementById('zoom-in').addEventListener('click',()=>{reader.zoom=Math.min(3,reader.zoom+.25);drawDocument(false);});
    document.getElementById('fit-page').addEventListener('click',()=>{reader.zoom=1;drawDocument(false);});
    showDialog();drawDocument();
  }

  function drawDocument(reset=true) {
    const page=reader.doc.pages[reader.page],img=document.getElementById('document-page');
    img.src=assetURL(page.image);img.alt=`${reader.doc.title}, page ${reader.page+1} of ${reader.doc.pages.length}`;img.width=page.width;img.height=page.height;img.style.width=`${reader.zoom*100}%`;
    document.getElementById('page-status').textContent=`Page ${reader.page+1} of ${reader.doc.pages.length}`;
    document.getElementById('previous-page').disabled=reader.page===0;document.getElementById('next-page').disabled=reader.page===reader.doc.pages.length-1;
    document.getElementById('zoom-out').disabled=reader.zoom<=1;document.getElementById('zoom-in').disabled=reader.zoom>=3;
    if(reset){const stage=document.getElementById('document-stage');stage.scrollTop=0;stage.scrollLeft=0;}
  }

  function openImage(path,title) {
    reader={image:path};dialog.classList.add('document-mode');contextLabel.textContent='Image';
    content.innerHTML=`<button class="back-button" type="button" id="back-project">${activeProject?'Back to project':'Back to projects'}</button><h2 id="dialog-title">${esc(title)}</h2><div class="image-stage"><img src="${esc(assetURL(path))}" alt="${esc(title)}"></div>`;
    document.getElementById('back-project').addEventListener('click',backToProject);showDialog();
  }

  function backToProject(){if(activeProject){openProject(activeProject);document.getElementById('dialog-title').focus();}else dialog.close();}

  document.querySelectorAll('.projects > li').forEach(card=>{
    const title=card.querySelector('[data-project]'),project=window.PROJECTS.find(p=>p.id===title.dataset.project);
    const preview=document.createElement('button');preview.className='card-preview';preview.type='button';preview.dataset.project=project.id;preview.setAttribute('aria-haspopup','dialog');preview.setAttribute('aria-label',`Open ${project.title}`);preview.innerHTML=cardGraphic(project);card.prepend(preview);
    card.addEventListener('click',event=>{if(!event.target.closest('a,button'))openProject(project.id);});
  });
  document.querySelectorAll('[data-project]').forEach(button=>button.addEventListener('click',()=>openProject(button.dataset.project)));
  close.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');activeProject=null;reader=null;dialog.classList.remove('document-mode');});
  dialog.addEventListener('cancel',event=>{if(reader&&activeProject){event.preventDefault();backToProject();}});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();});
  connectAssets(document);
})();
