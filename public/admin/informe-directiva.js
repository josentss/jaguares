/* Informe vectorial A4 de dos páginas. Usa jsPDF incluido en html2pdf,
   ya utilizado por la planilla institucional. No sube datos ni usa otra API. */
(function(root){
    'use strict';
    const naranja=[211,81,21], tinta=[32,41,55], gris=[91,105,121], borde=[225,230,236],
        suave=[245,247,249], verde=[49,128,82], ambar=[214,138,40], rojo=[180,81,81], neutro=[148,163,184];
    const fmt=new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2});
    const moneda=(n,s)=>Number.isFinite(n)?fmt.format(n)+' '+s:'N/D';
    const porcentaje=(n,t)=>t?Math.round(n/t*100)+'%':'0%';
    const fecha=iso=>new Intl.DateTimeFormat('es-VE',{timeZone:'America/Caracas',dateStyle:'short',timeStyle:'short'}).format(new Date(iso));
    function texto(doc,s,x,y,{size=10,bold=false,color=tinta,max=180,align='left'}={}){
        const str=String(s);
        doc.setFont('helvetica',bold?'bold':'normal');
        doc.setTextColor(...color);
        doc.setFontSize(size);
        while(doc.getTextWidth(str)>max&&size>7){size-=.5;doc.setFontSize(size);}
        doc.text(str,x,y,{align});
    }
    function caja(doc,x,y,w,h){
        doc.setDrawColor(...borde);doc.setFillColor(...suave);doc.setLineWidth(.25);
        doc.roundedRect(x,y,w,h,2,2,'FD');
    }
    function tarjetas(doc,items,y){
        const w=(182-(items.length-1)*3)/items.length;
        items.forEach(([label,value],i)=>{
            const x=14+i*(w+3);
            caja(doc,x,y,w,22);
            texto(doc,label,x+3,y+7,{size:9,color:gris,max:w-6});
            texto(doc,value,x+3,y+17,{size:15,bold:true,max:w-6});
        });
    }
    function cabecera(doc,titulo,sub,captura,n){
        doc.setFillColor(255,255,255);doc.rect(0,0,210,297,'F');
        doc.setFillColor(...naranja);doc.rect(14,13,182,1.2,'F');
        texto(doc,'CLUB DE VOLEIBOL JAGUARES',14,21,{bold:true,size:10,color:naranja});
        texto(doc,titulo,14,32,{size:21,bold:true});
        texto(doc,sub,14,39,{size:10,color:gris});
        texto(doc,'Consulta: '+fecha(captura)+' (Caracas)',196,21,{align:'right',size:8,max:85,color:gris});
        doc.setDrawColor(...borde);doc.line(14,276,196,276);
        texto(doc,'Uso interno | Estadísticas acumuladas de la academia',14,283,{size:8,color:gris});
        texto(doc,n+' / 2',196,283,{size:8,color:gris,align:'right'});
    }
    function donut(doc,items,total){
        const cx=45,cy=109,r=24;
        doc.setFillColor(...suave);doc.circle(cx,cy,r,'F');
        let a=-Math.PI/2;
        for(const [,n,color] of items){
            if(!n||!total)continue;
            const b=a+n/total*2*Math.PI, pasos=Math.max(2,Math.ceil((b-a)*16));
            const puntos=[[cx,cy]];
            for(let i=0;i<=pasos;i++){
                const angle=a+(b-a)*i/pasos;
                puntos.push([cx+r*Math.cos(angle),cy+r*Math.sin(angle)]);
            }
            puntos.push([cx,cy]);
            doc.setFillColor(...color);
            doc.lines(puntos.slice(1).map((p,i)=>[p[0]-puntos[i][0],p[1]-puntos[i][1]]),cx,cy,[1,1],'F',true);
            a=b;
        }
        doc.setFillColor(255,255,255);doc.circle(cx,cy,14.5,'F');
        texto(doc,total,cx,108,{align:'center',bold:true,size:18,max:27});
        texto(doc,'Atletas',cx,115,{align:'center',size:8,color:gris,max:25});
        items.forEach(([label,n,color],i)=>{
            const y=92+i*11;
            doc.setFillColor(...color);doc.roundedRect(80,y-3,4,4,1,1,'F');
            texto(doc,label,87,y,{size:10,max:75});
            texto(doc,n+'  ('+porcentaje(n,total)+')',194,y,{align:'right',bold:true,max:55});
        });
    }
    function pila(doc,y,items,total){
        doc.setFillColor(...suave);doc.rect(14,y,182,5,'F');
        let x=14;
        for(const [n,color] of items){
            const w=total?182*n/total:0;
            if(w>0){doc.setFillColor(...color);doc.rect(x,y,w,5,'F');x+=w;}
        }
    }
    function barras(doc,items,total,y){
        items.forEach(([label,n,color],i)=>{
            const fila=y+i*13;
            texto(doc,label,14,fila+3,{size:10,max:40});
            doc.setFillColor(...suave);doc.roundedRect(57,fila-1,103,5,1,1,'F');
            const w=total?103*n/total:0;
            if(w>0){doc.setFillColor(...color);doc.rect(57,fila-1,w,5,'F');}
            texto(doc,n+'  ('+porcentaje(n,total)+')',196,fila+3,{align:'right',bold:true,size:10,max:33});
        });
    }
    async function descargar({auditoria:a,resumen:r}){
        if(typeof root.html2pdf!=='function')throw Error('Exportación PDF no disponible');
        // Obtener la instancia jsPDF de la dependencia fijada. Una semilla blanca
        // inicializa una sola página; todo el contenido posterior es vectorial.
        const canvas=document.createElement('canvas');
        canvas.width=32;canvas.height=32;
        const ctx=canvas.getContext('2d');
        if(!ctx)throw Error('Canvas no disponible');
        ctx.fillStyle='#fff';ctx.fillRect(0,0,32,32);
        const doc=await root.html2pdf().set({margin:0,jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}})
            .from(canvas,'canvas').toPdf().get('pdf');
        if(doc.getNumberOfPages()!==1)throw Error('Página inicial inválida');
        doc.setProperties({title:'Informe estadístico - Club Jaguares',subject:'Resumen administrativo',author:'Club Jaguares'});
        const atletas=a.atletas,pagos=a.pagos,f=a.finanzas;
        cabecera(doc,'Informe de gestión','Club y organización deportiva',a.consultado,1);
        tarjetas(doc,[['Registrados',atletas.total],['Activos',atletas.activo],['En espera',atletas.espera],['Inactivos',atletas.inactivo]],46);
        texto(doc,'Distribución de atletas',14,79,{bold:true,size:12});
        const estados=[['Activos',atletas.activo,verde],['En espera',atletas.espera,ambar],['Inactivos',atletas.inactivo,neutro]];
        if(atletas.otros)estados.push(['Otros',atletas.otros,rojo]);
        donut(doc,estados,atletas.total);
        const asignados=r.activos_con_equipo,sin=r.activos_sin_equipo,cobertura=asignados+sin;
        texto(doc,'Asignación deportiva',14,143,{bold:true,size:12});
        texto(doc,cobertura?porcentaje(asignados,cobertura)+' con equipo':'Sin atletas activos',196,143,{align:'right',bold:true,size:10,max:60});
        pila(doc,149,[[asignados,verde],[sin,ambar]],cobertura);
        texto(doc,asignados+' con equipo',14,161,{size:10});
        texto(doc,sin+' sin asignación abierta',196,161,{align:'right',size:10,max:90});
        texto(doc,'Organización deportiva',14,173,{bold:true,size:12});
        tarjetas(doc,[['Temporadas',r.temporadas],['Categorías',r.categorias],['Equipos',r.equipos],['Eventos próximos',r.eventos_proximos]],178);
        texto(doc,'Pendientes de gestión',14,212,{bold:true,size:12});
        const pendientes=[['Pagos por revisar',pagos.pendiente],['Atletas por aprobar',atletas.espera],
            ['Solicitudes de representantes',r.representantes_pendientes],['Activos sin asignación',sin]];
        pendientes.forEach(([label,n],i)=>{
            const x=14+(i%2)*93,y=218+Math.floor(i/2)*15;
            caja(doc,x,y,89,12);texto(doc,label,x+3,y+7.6,{size:9,max:65});texto(doc,n,x+86,y+7.6,{bold:true,align:'right',max:18});
        });
        texto(doc,'Representantes aprobados: '+r.representantes_aprobados,14,257,{bold:true,size:10});
        texto(doc,'Organización consultada: '+fecha(r.consultado)+' (Caracas)',14,266,{size:8,color:gris});

        doc.addPage('a4','portrait');
        cabecera(doc,'Informe de gestión','Administración financiera',a.consultado,2);
        texto(doc,'Ingresos aprobados por moneda original',14,48,{bold:true,size:12});
        tarjetas(doc,[['USD',moneda(f.usd,'USD')],['Bolívares',moneda(f.bs,'Bs')],['Pesos colombianos',moneda(f.cop,'COP')]],53);
        texto(doc,'Referencias de mercado',14,87,{bold:true,size:12});
        tarjetas(doc,[['USD',moneda(f.tasaUSD,'Bs/USD')],['EUR',moneda(f.tasaEUR,'Bs/EUR')]],93);
        texto(doc,'ExchangeRate-API | '+(f.fechaReferencia||'Fecha no disponible')+' | No es tasa oficial BCV',14,123,{size:8,color:gris});
        texto(doc,'Equivalencias estimadas (USD y Bs)',14,135,{bold:true,size:11});
        texto(doc,moneda(f.equivalenteUSD,'USD'),14,144,{bold:true,size:12,max:87});
        texto(doc,moneda(f.equivalenteBs,'Bs'),107,144,{bold:true,size:12,max:89});
        texto(doc,'Excluyen COP y no representan ingresos adicionales.',14,151,{size:8,color:gris});
        texto(doc,'Pagos reportados por estado',14,165,{bold:true,size:12});
        texto(doc,'Total: '+pagos.total,196,165,{align:'right',bold:true,size:10,max:40});
        const filas=[['Aprobados',pagos.aprobado,verde],['Pendientes',pagos.pendiente,ambar],['Rechazados',pagos.rechazado,rojo]];
        if(pagos.otros)filas.push(['Otros',pagos.otros,neutro]);
        barras(doc,filas,pagos.total,175);
        doc.setDrawColor(...borde);doc.line(14,231,196,231);
        texto(doc,'Alcance del informe',14,240,{bold:true,size:11});
        texto(doc,'Los importes corresponden a pagos aprobados acumulados, no a saldos por cobrar.',14,249,{size:9,color:gris});
        texto(doc,'Los gráficos cuentan reportes, no montos. Las monedas se mantienen separadas.',14,256,{size:9,color:gris});
        texto(doc,'N/D indica referencia o equivalencia no disponible.',14,263,{size:9,color:gris});
        const dia=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'})
            .formatToParts(new Date()).filter(p=>p.type!=='literal');
        const partes=Object.fromEntries(dia.map(p=>[p.type,p.value]));
        doc.save('Informe_Jaguares_'+partes.year+'-'+partes.month+'-'+partes.day+'.pdf');
    }
    root.JaguaresInforme={descargar};
})(window);
