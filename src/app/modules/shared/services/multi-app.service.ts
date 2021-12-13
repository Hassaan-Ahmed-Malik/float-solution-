import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
// import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject } from 'rxjs';
import { CONSTANTS } from '../helpers/constants';
import { HelperService } from '../helpers/helper.service';

declare var window:any;
declare var $:any;

@Injectable({
  providedIn: 'root'
})
export class MultiAppService {


  // toastr = {
  //   success: (a, b = '')  => {},
  //   info: (a, b = '') => {},
  //   warning: (a, b = '') => {},
  //   error: (a, b = '') => {},
  // }

  ws_for_multiWinApp = null;
  FilesArray = [];
  webSocketUrlForWinMultiApp = CONSTANTS.MULTI_APP.WS_URL;
  resizeImageDimentions = {
    width: 500,
    height: 500
  }

  private multiAppConnectionStatus$ = new BehaviorSubject(false);
  multiAppConnectionStatus = this.multiAppConnectionStatus$.asObservable();


  private scannedDoc$ = new BehaviorSubject(null);
  scannedDoc = this.scannedDoc$.asObservable();

  constructor(
    private toastr: ToastrService,
    private helperSrv: HelperService
    ) { }




  sendCommand (cmd) {
    if(cmd){
      cmd = JSON.stringify(cmd);
    }
    if (this.checkIfMultiAppConnected()) {
      this.ws_for_multiWinApp.send(cmd);
    } else {
      this.connectToMultiApp(cmd || '');
    }
  }
  connectToMultiApp (cmd = '') {
    let _self = this;
    var i = 0;
    try {
      var wsImpl = window.WebSocket || window.MozWebSocket;
      this.ws_for_multiWinApp = new wsImpl(this.webSocketUrlForWinMultiApp);
      if (this.ws_for_multiWinApp) {
        this.setMultiAppConnectionStatus(true);
        this.ws_for_multiWinApp.onmessage = (e) => {
          this.setMultiAppConnectionStatus(true);
          console.log('data from Win WebDesk => ', e);
          let data_from_fpScanner = e.data;
          try {
            data_from_fpScanner = JSON.parse(data_from_fpScanner);
            switch (data_from_fpScanner.type) {
              case 'FPVerify':
                if (data_from_fpScanner.status) {
                  // TODO: finger print scan
                }
                break;
              case 'ScanImage':
                if (data_from_fpScanner.status || !data_from_fpScanner.data) {
                  data_from_fpScanner.data = CONSTANTS.IMAGE_PREFIX.PNG + data_from_fpScanner.data;
                  // let base64Img = data_from_fpScanner.data;
                  // data_from_fpScanner.data = this.base64toBlob(data_from_fpScanner.data, 'image/png');
                  // if (data_from_fpScanner.data instanceof Blob) {
                    this.resizeImage('', this.resizeImageDimentions.width, this.resizeImageDimentions.height, 0, data_from_fpScanner.data).then((res) => {
                      i++;
                      // console.log('Newwwwwwwwwwwwwwwwwwwww ', data_from_fpScanner.data);
                      let f:any = res;//data_from_fpScanner.data;
                      let fileName = "File_" + +new Date(); //"File" + i;
                      // var reader = new FileReader();
                      // reader.onload = (e) => {
                        // var newImage = `<div class="col-sm-2 file-row" id="${fileName}" style="padding-bottom: 5px;border: 1px solid black;margin-top: 5px; margin-left: 2px;">
                        //                     <img height="120" width="100%" src="${data_from_fpScanner.data}"/>
                        //                 </div>`;
                        // let selDiv = document.querySelector('body');
                        // selDiv.append(newImage);
                        var file = _self.dataURLtoFile(data_from_fpScanner.data, fileName);
                        var fileObject = {
                          FileName: fileName,
                          IsScanned: true,
                          IsUploaded: false,
                          IsDeleted: false,
                          FileTypeID: null,
                          ActualFile: file,
                          FileBase64Data: data_from_fpScanner.data
                        };
                        _self.FilesArray.push(fileObject);

                        let _obj:any = {};
                        _obj.Doc = (fileObject.FileBase64Data || '');
                        _obj.DocId = null;
                        _obj.Title = fileObject.FileName || (+new Date());
                        _obj.VisitDocType = 'image/png';
                        _obj.VisitDocBase64Thumbnail = '';
                        _obj.VisitId = null;
                        let imgDataFormatted = this.helperSrv.addPrefixToDocs([_obj]);
                        console.log('imgDataFormatted from scanner ',imgDataFormatted);
                        this.updateScannedDoc(imgDataFormatted);
                      // }
                      // reader.readAsDataURL(f);
                    }, (err) => {
                        this.toastr.error('File not found');
                    });
                  // }
                } else {
                    this.toastr.info('No image data');
                }
                break;
              case 'Print':
                // code block
                break;
              default:
              // code block
            }
          } catch (excp) {
              console.log(excp);
          }
        };
        this.ws_for_multiWinApp.onopen = () => {
          this.setMultiAppConnectionStatus(true);
          //Do whatever u want when connected succesfully
          console.log("connection to WebDesk is established");
          this.toastr.success('connection to WebDesk is established', 'Connected');
          if (cmd) {
              this.sendCommand(cmd);
          }
        };
        this.ws_for_multiWinApp.onclose = () => {
          this.setMultiAppConnectionStatus(false);
          console.log("connection to WebDesk is closed");
          this.toastr.error('connection to WebDesk is closed', 'Disconnected');
          //toastr.success('connection to Win WebDesk is closed', 'Disconnection');
        };
        this.ws_for_multiWinApp.onerror = (event) => {
          this.setMultiAppConnectionStatus(false);
          console.log('Failure establishing connection to WebDesk', event.data);
          this.toastr.error('Failure establishing connection to WebDesk', 'Disconnected');
          //toastr.warning('Failure establishing connection to Win WebDesk', 'Connection Failed');
        }
      }
    }
    catch (e) {
      console.log('ERROR implementing WebSocket for WebDesk.', e);
      this.toastr.error('ERROR implementing WebSocket for WebDesk.');
    }
  }
  disconnectToMultiApp() {
    if(this.checkIfMultiAppConnected()) {
      try{
        this.ws_for_multiWinApp.close();
      } catch(ex){}
      this.setMultiAppConnectionStatus(false);
    }
  }
  checkIfMultiAppConnected():boolean {
    let connected = false;
    if (this.ws_for_multiWinApp) {
      if (this.ws_for_multiWinApp.readyState === (window.WebSocket || window.MozWebSocket).CLOSED) {
        connected = false;
      } else {
        connected = true;
      }
    }
    return connected;
  }
  base64toBlob(base64Data, contentType) {
      contentType = contentType || '';
      var sliceSize = 1024;
      var byteCharacters = '';
      try {
          byteCharacters = atob(base64Data);
      }
      catch (ex) {
          byteCharacters = base64Data;
      }
      var bytesLength = byteCharacters.length;
      var slicesCount = Math.ceil(bytesLength / sliceSize);
      var byteArrays = new Array(slicesCount);

      for (var sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
          var begin = sliceIndex * sliceSize;
          var end = Math.min(begin + sliceSize, bytesLength);

          var bytes = new Array(end - begin);
          for (var offset = begin, i = 0; offset < end; ++i, ++offset) {
              bytes[i] = byteCharacters[offset].charCodeAt(0);
          }
          byteArrays[sliceIndex] = new Uint8Array(bytes);
      }
      return new Blob(byteArrays, { type: contentType });
  }
  dataURLtoFile(dataurl, filename) {
      var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
          bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
      while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, {
          type: mime
      });
  }
  dataURItoBlob(dataURI) {
    // convert base64 to raw binary data held in a string
    // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
    var byteString = atob(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

    // write the bytes of the string to an ArrayBuffer
    var ab = new ArrayBuffer(byteString.length);

    // create a view into the buffer
    var ia = new Uint8Array(ab);

    // set the bytes of the buffer to the correct values
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    // write the ArrayBuffer to a blob, and you're done
    var blob = new Blob([ab], { type: mimeString });
    return blob;

  }
  resizeImage(file, maxWidth, maxHeight, compressionRatio = 0, imageEncoding = '', base64Data = '') {
    const self = this;
    let promise = new Promise( (resolve, reject) => {
      if(!file && !base64Data) {
        resolve('');
      }
      const fileLoader = new FileReader();
      const canvas = document.createElement('canvas');
      let context = null;
      const imageObj:any = new Image();
      let blob = null;
  
      // create a hidden canvas object we can use to create the new resized image data
      let canvas_id = 'hiddenCanvas_'+ +new Date();
      canvas.id = canvas_id;
      canvas.width = maxWidth;
      canvas.height = maxHeight;
      canvas.style.visibility = 'hidden';
      document.body.appendChild(canvas);
  
      // console.log('base64Data ', base64Data);
      if(base64Data) {
        if(base64Data.indexOf('data:image') == -1) { // if pdf, icon or any other file then don't resize
          resolve('');
          return promise;
        }
        imageObj.src = base64Data;
      } else if(file && file.size) {
      // check for an image then
      // trigger the file loader to get the data from the image
      // if (file.type.match('image.*')) {
        fileLoader.readAsDataURL(file);
        // } else {
        // alert('File is not an image');
        // }
    
        // setup the file loader onload function
        // once the file loader has the data it passes it to the
        // image object which, once the image has loaded,
        // triggers the images onload function
        fileLoader.onload = function () {
          const data = this.result;
          imageObj.src = data;
        };
    
        fileLoader.onabort = () => {
          reject('The upload was aborted.');
          this.toastr.error('The upload was aborted.');
        };
    
        fileLoader.onerror = () => {
          reject('An error occured while reading the file.');
          this.toastr.error('An error occured while reading the file.');
        };
      }

      // set up the images onload function which clears the hidden canvas context,
      // draws the new image then gets the blob data from it
      imageObj.onload = function () {
          // Check for empty images
          if (this.width === 0 || this.height === 0) {
            this.toastr.error('Image is empty');
          } else {
            // get the context to use
            // context = canvas.getContext('2d');
            // context.clearRect(0, 0, max_width, max_height);
            // context.drawImage(imageObj, 0, 0, this.width, this.height, 0, 0, max_width, max_height);
            const newSize = self.calculateAspectRatioFit(this.width, this.height, maxWidth, maxHeight);
            canvas.width = newSize.width;
            canvas.height = newSize.height;
            context = canvas.getContext('2d');
            context.clearRect(0, 0, newSize.width, newSize.height);
            context.drawImage(imageObj, 0, 0, this.width, this.height, 0, 0, newSize.width, newSize.height);
            // dataURItoBlob function available here:
            // http://stackoverflow.com/questions/12168909/blob-from-dataurl
            // add ')' at the end of this function SO dont allow to update it without a 6 character edit
            blob = canvas.toDataURL(imageEncoding);
            document.getElementById(canvas_id).remove();
            // pass this blob to your upload function
            resolve(blob);
          }
      };
  
      imageObj.onabort = () => {
        reject('Image load was aborted.');
        this.toastr.error('Image load was aborted.');
      };
  
      imageObj.onerror = () => {
        resolve(imageObj.currentSrc || '');
        // reject('An error occured while loading image.');
        this.toastr.error('An error occured while loading image.');
      };
    })
    return promise;
  }
  calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return { width: srcWidth*ratio, height: srcHeight*ratio };
  }




  refreshMultiAppConnectionStatus() {
    this.multiAppConnectionStatus$.next(this.getMultiAppConnectionStatus() || false);
  }
  setMultiAppConnectionStatus(connectionStatus) {
    if(!connectionStatus) {
      this.ws_for_multiWinApp = null;
    }
    this.multiAppConnectionStatus$.next(connectionStatus || false);
  }
  getMultiAppConnectionStatus():boolean {
    return this.checkIfMultiAppConnected();
  }

  updateScannedDoc(doc) {
    this.scannedDoc$.next(doc || null);
  }

}
