/**
 * Visualizador 3D do Meta Quest 3 (componente <model-viewer>)
 *
 * O que este arquivo resolve:
 *
 *  1) A biblioteca <model-viewer> é carregada tentando várias fontes (CDNs),
 *     uma depois da outra. Se uma URL estiver fora do ar ou não existir,
 *     o site passa automaticamente para a próxima.
 *
 *  2) Quando o site é aberto com duplo clique no arquivo (endereço file:///...),
 *     o navegador bloqueia a leitura do arquivo .glb por segurança (CORS).
 *     Nesse caso, o modelo é lido de "Quest3.glb.js" (o mesmo modelo, em base64),
 *     que o navegador permite carregar. Em um servidor/hospedagem normal
 *     (http/https) esse arquivo NÃO é usado e o .glb é carregado direto.
 *
 *  3) Se algo falhar, a imagem de reserva continua aparecendo e o motivo
 *     é escrito no console do navegador (tecla F12 > aba Console).
 */
(function () {
  'use strict';

  var TAG = '[Visualizador 3D]';

  // Fontes da biblioteca, em ordem de tentativa.
  // O jsDelivr espelha o npm, então a versão exata sempre existe lá.
  var MODEL_VIEWER_SOURCES = [
    'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.3.1/dist/model-viewer.min.js',
    'https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js',
    'https://unpkg.com/@google/model-viewer@4.3.1/dist/model-viewer.min.js'
  ];

  // Cópia do modelo em base64, usada só quando o site abre via file://
  var EMBEDDED_MODEL_SCRIPT = 'assets/models/meta-quest-3/Quest3.glb.js';
  var EMBEDDED_MODEL_VARIABLE = 'QUEST3_GLB_BASE64';

  // Tempo máximo de espera por cada fonte (rede lenta ou bloqueada)
  var SOURCE_TIMEOUT_MS = 15000;

  /** Carrega um script do tipo module e confirma que o <model-viewer> foi registrado. */
  function loadModule(url) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var timer = setTimeout(function () {
        reject(new Error('demorou mais de ' + (SOURCE_TIMEOUT_MS / 1000) + 's para responder'));
      }, SOURCE_TIMEOUT_MS);

      script.type = 'module';
      script.src = url;

      script.onload = function () {
        clearTimeout(timer);
        if (customElements.get('model-viewer')) {
          resolve();
        } else {
          reject(new Error('o arquivo carregou, mas não registrou o <model-viewer>'));
        }
      };

      script.onerror = function () {
        clearTimeout(timer);
        reject(new Error('não foi possível baixar o arquivo (offline, bloqueado ou URL inexistente)'));
      };

      document.head.appendChild(script);
    });
  }

  /** Tenta cada fonte até uma funcionar. Resolve true/false. */
  async function loadModelViewerLibrary() {
    if (customElements.get('model-viewer')) return true;

    for (var i = 0; i < MODEL_VIEWER_SOURCES.length; i++) {
      var url = MODEL_VIEWER_SOURCES[i];
      try {
        await loadModule(url);
        console.info(TAG + ' Biblioteca carregada de ' + url);
        return true;
      } catch (err) {
        console.warn(TAG + ' Falhou: ' + url + ' -> ' + err.message);
      }
    }
    return false;
  }

  /** Lê o modelo embutido (base64) e devolve uma URL temporária (blob:) para o <model-viewer>. */
  function loadEmbeddedModel() {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = EMBEDDED_MODEL_SCRIPT;

      script.onload = function () {
        try {
          var base64 = window[EMBEDDED_MODEL_VARIABLE];
          if (!base64) throw new Error('a variável ' + EMBEDDED_MODEL_VARIABLE + ' está vazia');

          var binary = atob(base64);
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

          window[EMBEDDED_MODEL_VARIABLE] = null; // libera memória
          resolve(URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' })));
        } catch (err) {
          reject(err);
        }
      };

      script.onerror = function () {
        reject(new Error('arquivo "' + EMBEDDED_MODEL_SCRIPT + '" não encontrado'));
      };

      document.head.appendChild(script);
    });
  }

  function init() {
    var viewers = document.querySelectorAll('.vr-model-viewer');
    if (!viewers.length) return;

    var openedFromDisk = window.location.protocol === 'file:';
    var stages = [];

    viewers.forEach(function (viewer) {
      var stage = viewer.closest('.vr-viewer__stage');
      if (!stage) return;
      stages.push(stage);

      function showFallback(reason) {
        console.error(TAG + ' ' + reason);
        stage.classList.add('is-model-error');
      }

      // Modelo carregado: esconde a imagem de reserva
      viewer.addEventListener('load', function () {
        stage.classList.add('is-model-ready');
        stage.classList.remove('is-model-error');
      });

      // O <model-viewer> não conseguiu ler o modelo
      viewer.addEventListener('error', function (event) {
        var detail = event && event.detail;
        showFallback('O modelo .glb não carregou. ' + (detail && detail.sourceError ? detail.sourceError.message : ''));
      });

      if (openedFromDisk) {
        console.info(TAG + ' Site aberto via file:// -> usando o modelo embutido (Quest3.glb.js).');
        // Sem o src, o navegador não tenta (e falha em) ler o .glb diretamente.
        viewer.removeAttribute('src');
        loadEmbeddedModel()
          .then(function (blobUrl) { viewer.setAttribute('src', blobUrl); })
          .catch(function (err) { showFallback('Modelo embutido indisponível: ' + err.message); });
      }
    });

    loadModelViewerLibrary().then(function (ok) {
      if (ok) return;
      stages.forEach(function (stage) {
        stage.classList.add('is-model-error');
      });
      console.error(
        TAG + ' Nenhuma fonte da biblioteca <model-viewer> respondeu. ' +
        'Verifique a conexão com a internet (ou se a rede bloqueia CDNs).'
      );
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
