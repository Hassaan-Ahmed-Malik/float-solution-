import { ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { NgxSpinnerService } from 'ngx-spinner';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/modules/auth';
import { IVisitDocs } from 'src/app/modules/auth/_models/documents.model';
import { UserModel } from 'src/app/modules/auth/_models/user.model';
// import { User } from '../../../../models/user';
import { AppPopupService } from '../../../helpers/app-popup.service';
import { CONSTANTS } from '../../../helpers/constants';
import { HelperService } from '../../../helpers/helper.service';
import { MultiAppService } from '../../../services/multi-app.service';
// import { StorageService } from '../../../helpers/storage.service';
import { DocsService } from '../services/docs.service';
// import  * as ImgPreviewer from '../image-viewer.js';

@Component({
  selector: 'app-visit-docs',
  templateUrl: './visit-docs.component.html',
  styleUrls: ['./visit-docs.component.scss']
})
export class VisitDocsComponent implements OnInit {

  @ViewChild('documentPopup') documentPopup;
  documentPopupRef: NgbModalRef;
  defaultEditing = {save: false, select: true, camera: true};
  @Input('propVisitNo') propVisitNo = '';
  @Input('layout') attachmentLayout = 'grid2'; // compact | list | grid | grid2
  @Input('layoutButtons') layoutButtons = ['compact', 'list', 'grid', 'grid2']; // ['compact', 'list', 'grid', 'grid2']
  @Input('editing') editing = this.defaultEditing; // {save: true, select: true, camera: true, scan: true}
  @Input('inputDocs') inputDocs = [];
  @Input('allowRemove') allowRemove = false;
  @Input('forFilterComp') forFilterComp = 0;
  @Output() outputDocs = new EventEmitter();
  @ViewChild('videoElement') videoElement: ElementRef;
  @ViewChild("canvas") public canvas: ElementRef;

  loggedInUser: UserModel;
  
  video: any;
  activeVideoCameraStream: any;
  openCameraFromSource = '';
  videoDimensions = {
    width: 300,
    height: 300
  }
  cameraDevicesList = [{id: '', name: 'default'}];
  selectedCamera = '';

  capturedImage = '';

  enableRenameVisitAttachmentField = -1;

  resizeFileSize = {
    thumbnail: {
      width: 90,
      height: 90
    },
    width: 500,
    height: 500
  }

  spinnerRefs = {
    visitDocs: 'visitDocs',
    selectedDoc: 'selectedDoc'
  }
  confirmationPopoverConfig = {
    placements: ['top', 'left', 'right', 'bottom'],
    popoverTitle: 'Confirmation Alert', // 'Are you sure?',
    popoverMessage: 'Are you <b>sure</b> you want to proceed?',
    confirmText: 'Yes <i class="fa fa-check"></i>',
    cancelText: 'No <i class="fa fa-times"></i>',
    confirmClicked: false,
    cancelClicked: false,
    confirmPopoverCancel: () => {}
  }

  visitAttachments = [];

  imgViewer;

  selectedImg:IVisitDocs;

  ngbModalOptions: NgbModalOptions = {
      backdrop : true, // 'static',
      keyboard : true
  };

  multiAppConnectionStatus = false;

  constructor(
    private spinner: NgxSpinnerService,
    private toastr: ToastrService,
    private sanitizer: DomSanitizer,
    private docsService: DocsService,
    // private storageService: StorageService,
    private auth: AuthService,
    private helper: HelperService,
    private appPopupService: AppPopupService,
    private multiApp: MultiAppService,
    private cd: ChangeDetectorRef
  ) {
  }

  ngOnInit(): void {
    // console.log('ngOnInit propVisitNo  ', this.propVisitNo, this.attachmentLayout);
    // console.log('ImgPreviewer ', ImgPreviewer);
    this.reEvaluateEditingPermissions();
    this.loadLoggedInUserInfo();
    if(this.inputDocs && this.inputDocs.length) {
      this.setVisitDocsArray(this.inputDocs, false);
    } else if(this.propVisitNo) {
      this.getVisitDocs();
    } else {
      this.setVisitDocsArray([], true);
    }
    this.connectToMultiApp();
    this.subscribeFirMultiAppStatus();
    this.subscribeForScannedDoc();
  }

  ngAfterViewInit() {
    // console.log('ngAfterViewInit propVisitNo  ', this.propVisitNo, this.attachmentLayout);
    this.reEvaluateEditingPermissions();
    if(this.inputDocs && this.inputDocs.length) {
      this.setVisitDocsArray(this.inputDocs, false);
    } else if(this.propVisitNo) {
      this.getVisitDocs();
    } else {
      this.setVisitDocsArray([], true);
    }
    this.video = this.videoElement.nativeElement;
    this.initImageViewer();
  }

  ngOnChanges(e) {
    // console.log('ngOnChanges propVisitNo  ', this.propVisitNo, this.attachmentLayout);
    this.reEvaluateEditingPermissions();
    if(this.inputDocs && this.inputDocs.length) {
      this.setVisitDocsArray(this.inputDocs, false);
    } else if(this.propVisitNo) {
      this.getVisitDocs();
    } else {
      this.setVisitDocsArray([], true);
    }
  }


  loadLoggedInUserInfo() {
    // this.loggedInUser = this.storageService.getLoggedInUserProfile();
    this.loggedInUser = this.auth.currentUserValue;

    // console.log('this.loggedInUser', this.loggedInUser);
  }


  getVisitDocs() {
    this.setVisitDocsArray([], true);
    let params = {
      visitId: this.propVisitNo,
      withDocs: true
    }
    if(!params.visitId) {
      return;
    }
    this.spinner.show(this.spinnerRefs.visitDocs);
    this.docsService.getVisitDocuments(params).subscribe( (res:any) => {
      this.setVisitDocsArray([], true);
      this.spinner.hide(this.spinnerRefs.visitDocs);
      if(res && res.StatusCode == 200) {
        if(res.PayLoad && res.PayLoad.length) {
          let _data = this.helper.addPrefixToDocs(res.PayLoad);
          this.setVisitDocsArray(_data, true);
          // this.outputDocs.emit(this.visitAttachments);
          // this.visitAttachments = res.PayLoad;
          // console.log(this.visitAttachments);
        }
      }
    }, (err) => {
      this.setVisitDocsArray([], true);
      this.spinner.hide(this.spinnerRefs.visitDocs);
      console.log(err);
      this.toastr.error('Error loading Documents');
    });
  }

  getVisitDocById(docId, uniqueIdentifier) {
    this.selectedImg = null;
    let params = {
      DocId: docId,
      ForFilter: this.forFilterComp
    }
    if(!params.DocId) {
      if(uniqueIdentifier) {
        this.documentPopupRef = this.appPopupService.openModal(this.documentPopup, this.ngbModalOptions);
        this.selectedImg = this.visitAttachments.find( a => a.uniqueIdentifier == uniqueIdentifier);
      }
      return;
    }
    this.documentPopupRef = this.appPopupService.openModal(this.documentPopup, this.ngbModalOptions);
    this.spinner.show(this.spinnerRefs.selectedDoc);
    this.docsService.getVisitDocumentById(params).subscribe( (res:any) => {
      this.spinner.hide(this.spinnerRefs.selectedDoc);
      if(res && res.StatusCode == 200) {
        if(res.PayLoad && res.PayLoad.length) {
          let data = this.helper.addPrefixToDocs(res.PayLoad);

          // data[0].docId = data[0].DocId || '__';
          // data[0].uniqueIdentifier = (+new Date());
          // data[0].fileName = data[0].Title;
          // data[0].fileType = data[0].VisitDocType || 'image/png';
          // data[0].data = data[0].VisitDocBase64;
          // data[0].sanitizedData = this.sanitizer.bypassSecurityTrustResourceUrl(data[0].VisitDocBase64);
          // data[0].thumbnail = data[0].VisitDocBase64Thumbnail;
          // data[0].visitId = data[0].VisitId;
          
          this.selectedImg = data[0];
          // this.visitAttachments = res.PayLoad;
          // console.log(this.visitAttachments);
        }
      }
    }, (err) => {
      this.spinner.hide(this.spinnerRefs.selectedDoc);
      console.log(err);
      this.toastr.error('Error loading Document');
    });
  }

  reloadVisitDocs() {
    if(this.propVisitNo) {
      this.getVisitDocs();
      // console.log("reload")
    }
  }

  saveVisitDocs() {
    let params = {
      UserId: this.loggedInUser.userid,
      Docs: this.getVisitAttachmentsData()
    }

    if(!params.UserId || !params.Docs.length) {
      return;
    }
    this.spinner.show(this.spinnerRefs.visitDocs);
    this.docsService.saveVisitDocuments(params).subscribe( (res:any) => {
      this.spinner.hide(this.spinnerRefs.visitDocs);
      if(res && res.StatusCode == 200) {
        this.toastr.success('Visit Documents Saved');
        this.getVisitDocs();
      } else {
        this.toastr.error('Error Saving Documents.');
      }
    }, (err) => {
      this.spinner.hide(this.spinnerRefs.visitDocs);
      console.log(err);
      this.toastr.error('Error Saving Documents');
    });
  }



  /*
  formatVisitDocsData(data) {
    const loadImagePromises = [];
    let _data = data;
    try {
      _data = this.helper.addPrefixToDocs(data);
    
      
      // this.spinner.show(this.spinnerRefs.visitDocs);
      // Array.from(data).forEach( (doc:any, i) => {
      //   // doc.Doc = doc.VisitDocBase64 || doc.Doc;
      //   // let docPrefix = data:application/pdf;base64,
      //   let _formattedPic = doc.data; // doc.Doc ? ((doc.Doc.indexOf('data:') == -1) ? (CONSTANTS.IMAGE_PREFIX.PNG + doc.Doc) : doc.Doc) : '';
      //   loadImagePromises.push(this.resizeImage('', this.resizeFileSize.thumbnail.width, this.resizeFileSize.thumbnail.height, 0, '', _formattedPic));
      // });
      // Promise.all(loadImagePromises).then(responses => {
      //   this.spinner.hide(this.spinnerRefs.visitDocs);

      //   data.forEach( (a, i) => {
      //     let _formattedPic = a.data; //a.Doc ? ((a.Doc.indexOf('data:') == -1) ? (CONSTANTS.IMAGE_PREFIX.PNG + a.Doc) : a.Doc) : '';
      //     let obj = {
      //       docId: a.docId,
      //       uniqueIdentifier: (+new Date()),
      //       fileName: a.fileName,
      //       fileType: a.fileType || 'image/png',
      //       data: _formattedPic,
      //       sanitizedData: this.sanitizer.bypassSecurityTrustResourceUrl(_formattedPic),
      //       thumbnail: responses[i],
      //       visitId: a.visitId
      //     }
      //     // _data.push({
      //     //   VisitDocumentID: a.DocId,
      //     //   VisitID: a.VisitId,
      //     //   VisitDocTitle: a.Title,
      //     //   Remarks: a.Remarks || '',
      //     //   VisitDocumentPic: null, // a.data.replace(/^data:image\/[a-z]+;base64,/, ""), // it will be converted to byte[] in API for backward support
      //     //   VisitDocBase64: a.Doc,
      //     //   VisitDocBase64Thumbnail: responses[i],
      //     //   VisitDocType: a.fileType || 'image/png',
      //     //   VisitDocSourceID: a.VisitDocSourceID || 1, // from registration, visit creation
      //     //   // CreatedBy: this.loggedInUser.userid
      //     // });
      //     _data.push(obj)
      //   });
      //   this.visitAttachments = [...this.visitAttachments, ..._data];
      //   this.updateImageViewer();
      //   // console.log('responses => ', responses, this.visitAttachments);
      // }, (errors) => {
      //   this.spinner.hide(this.spinnerRefs.visitDocs);
      //   console.log(errors);
      // });
      
    } catch (e) {
      // this.spinner.hide(this.spinnerRefs.visitDocs);
    }
    return _data;
  }
  */





  /*  start - camera */
  initCamera(config:any) {
    var browser = <any>navigator;

    browser.getUserMedia = (browser.getUserMedia ||
      browser.webkitGetUserMedia ||
      browser.mozGetUserMedia ||
      browser.msGetUserMedia);

    if (this.activeVideoCameraStream) {
      this.stopCamera();
    }
    // console.log('config ', config);

    this.spinner.show();
    browser.mediaDevices.getUserMedia(config).then(stream => {
      this.spinner.hide();
      this.activeVideoCameraStream = stream;
      this.video.srcObject = stream;
      this.video.play();
      browser.mediaDevices.enumerateDevices().then( mediaDevices => {
        this.getCameraDevices(mediaDevices);
      })
    }).catch( error => {
      this.spinner.hide();
      this.toastr.warning(error);
    });
  }
  startCamera(settings = {}) {
    let _settings = { video: true, audio: false};
    _settings = {..._settings, ...settings};
    this.initCamera(_settings);
  }
  stopCamera() {
    if(this.activeVideoCameraStream){
      this.activeVideoCameraStream.getTracks().forEach( (track) => {
        track.stop();
    });
    }
    this.activeVideoCameraStream = '';
    this.canvas.nativeElement.getContext('2d').clearRect(0, 0, this.videoDimensions.width, this.videoDimensions.height);
  }
  capture() {
    var context = this.canvas.nativeElement.getContext("2d").drawImage(this.video, 0, 0, this.videoDimensions.width, this.videoDimensions.height);
    this.capturedImage = this.canvas.nativeElement.toDataURL("image/png");
    this.stopCamera();
  }
  captureDocument() {
    var context = this.canvas.nativeElement.getContext("2d").drawImage(this.video, 0, 0, this.videoDimensions.width, this.videoDimensions.height);
    let imageURL = this.canvas.nativeElement.toDataURL("image/png");
    let _fileName = 'capture_'+ +new Date();
    let _fileObject = {
      docId: null,
      uniqueIdentifier: (+new Date()),
      fileName: _fileName,
      fileType: 'image/png',
      data: imageURL,
      sanitizedData: this.sanitizer.bypassSecurityTrustResourceUrl(imageURL),
      sanitizedThumbnail: this.sanitizer.bypassSecurityTrustResourceUrl(''),
      thumbnail: '', // imageURL,
      visitId: this.propVisitNo || null
    };
    this.resizeImage('', this.resizeFileSize.thumbnail.width, this.resizeFileSize.thumbnail.height, 0, '', imageURL).then((res:string) => {
      _fileObject.thumbnail = res;
      _fileObject.sanitizedThumbnail = this.sanitizer.bypassSecurityTrustResourceUrl(res);
      // this.visitAttachments.push(_fileObject);
      this.updateVisitDocsArray([_fileObject], true);
      // this.updateImageViewer();
      // console.log(_fileObject);
      this.stopCamera();
    }, (err) => {
      this.toastr.warning('Invalid image captured');
      this.stopCamera();
    });
  }

  cameraChangedEvent() {
    this.openCamera('');
  }

  getCameraDevices(mediaDevices) {
    // console.log(this);
    // console.log('getCameraDevices ', mediaDevices);
    this.cameraDevicesList = [{id: '', name: 'default'}];
    let count = 1;
    mediaDevices.forEach(mediaDevice => {
      if (mediaDevice.kind === 'videoinput') {
        let obj = {
          id: mediaDevice.deviceId,
          name: mediaDevice.label || `Camera ${count++}`
        }
        // console.log('aaaaaaaaaaaa ', obj);
        this.cameraDevicesList.push(obj);
      }
    });
  }
  /* end - camera */





  loadSelectedAttachmentFileMultiple(event) {

    // console.log(this.visitAttachments);

    const files = (event.target as HTMLInputElement).files; // event.target.files;
    if (files.length) {
      this.spinner.show(this.spinnerRefs.visitDocs);
      const loadImagePromises = [];
      try {
        Array.from(files).forEach( (file:any, i) => {
          loadImagePromises.push(this.loadImage(file, 'file_'+ ++i));
        });
        Promise.all(loadImagePromises).then(responses => {
          event.target.value = '';
          this.spinner.hide(this.spinnerRefs.visitDocs);
          this.setVisitDocsArray([...this.visitAttachments, ...responses], true);
          // this.updateImageViewer();
          console.log('responses docs list => ', responses, this.visitAttachments);
        }, (errors) => {
          event.target.value = '';
          this.spinner.hide(this.spinnerRefs.visitDocs);
          console.log(errors);
        });
      } catch (e) {
        event.target.value = '';
        this.spinner.hide(this.spinnerRefs.visitDocs);
      }
    }
  }
  loadImage(file, fileName = 'file') {
    let promise = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        let imageURL = reader.result as string;
        let _fileName = file.name || '';
        //_fileName = `${fileName}`;
        let _fileObject = {
          docId: null,
          uniqueIdentifier: (+new Date()),
          fileName: _fileName,
          fileType: file.type || 'image/png',
          data: imageURL, //this.sanitizer.bypassSecurityTrustResourceUrl(imageURL),
          sanitizedData: this.sanitizer.bypassSecurityTrustResourceUrl(imageURL),
          sanitizedThumbnail: this.sanitizer.bypassSecurityTrustResourceUrl(''),
          thumbnail: '', //this.sanitizer.bypassSecurityTrustResourceUrl(imageURL).toString()
          visitId: this.propVisitNo || null
        };
        if(file.type.split('/')[0] == 'image' && file.type.split('/')[1] != 'svg+xml') { // resize only if it is image
          this.resizeImage(file, this.resizeFileSize.thumbnail.width, this.resizeFileSize.thumbnail.height, 0, '', imageURL).then((res:string) => {
            _fileObject.thumbnail = res;
            _fileObject.sanitizedThumbnail = this.sanitizer.bypassSecurityTrustResourceUrl(res);
            resolve(_fileObject);
          }, (err) => {
            reject(err);
          });
        } else {
          resolve(_fileObject);
        }
      }
      reader.readAsDataURL(file);
    });
    return promise;
  }
  openCamera(source) {
    let cameraSettings:any = {};
    if(source == 'patient_pic') {
      this.openCameraFromSource = source;
      // cameraSettings = {video: { facingMode: 'user' }};
    } else if(source == 'attachment') {
      this.openCameraFromSource = source;
      // cameraSettings = {video: { facingMode: 'environment' }};
    } else {
      // cameraSettings = {video: { facingMode: 'environment' }};
    }

    if (this.activeVideoCameraStream) {
      this.stopCamera();
    }
    cameraSettings = {};
    if (!this.selectedCamera) {
      cameraSettings.facingMode = 'environment';
    } else {
      cameraSettings.deviceId = { exact: this.selectedCamera };
    }
    const settings = {
      video: cameraSettings,
      audio: false
    };


    try {
      var browser = <any>navigator;
      browser.getUserMedia = (browser.getUserMedia ||
        browser.webkitGetUserMedia ||
        browser.mozGetUserMedia ||
        browser.msGetUserMedia);
      browser.mediaDevices.enumerateDevices().then( mediaDevices => {
        this.getCameraDevices(mediaDevices);
        this.startCamera(settings);
      })  
    } catch (e) {
      this.startCamera(settings);
    }
  }








  removeVisitAttachment(attachment) {
    if(attachment) {
      if(!this.allowRemove && attachment.docId) { // if added from another screen then don't remove
        return;
      }
      this.setVisitDocsArray(this.visitAttachments.filter(a => (a.uniqueIdentifier != attachment.uniqueIdentifier)), true);
    } else {
      // this.visitAttachments = [];
      this.setVisitDocsArray(this.visitAttachments.filter( a => a.docId), true);
    }
    // this.updateImageViewer();
  }

  toggleRenameField(action, attachment) {
    this.enableRenameVisitAttachmentField = -1;
    if(action == 'show') {
      if(attachment && (this.allowRemove || !attachment.docId)){
        this.enableRenameVisitAttachmentField = attachment.uniqueIdentifier;
      }
    }
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


  showRemoveAllDocsButton() {
    return this.visitAttachments.find( a => !a.docId);
  }
  showSaveDocsButton() {
    return this.visitAttachments.find( a => !a.docId) && this.editing.save;
  }

  getVisitAttachmentsData() {
    let docs = [];
    /*
    public class DocumentsModelForVisit
    {
      public int? VisitDocumentID { get; set; }
      public int? VisitID { get; set; }
      public string VisitDocTitle { get; set; }
      public string Remarks { get; set; }
      public byte[] VisitDocumentPic { get; set; }
      public string VisitDocBase64 { get; set; }
      public string VisitDocBase64Thumbnail { get; set; }
      public string VisitDocType { get; set; }
      public int VisitDocSourceID { get; set; } // { id to identify from where file is uploaded }
    }
    */

    this.visitAttachments.forEach( a => {
      let obj = {
        VisitDocumentID: a.docId,
        VisitID: a.visitId || this.propVisitNo,
        VisitDocTitle: a.fileName,
        Remarks: '',
        VisitDocumentPic: null,
        VisitDocBase64: a.data,
        VisitDocBase64Thumbnail: a.thumbnail,
        VisitDocType: a.fileType || 'image/png',
        VisitDocSourceID: 1
      }
      if(!obj.VisitDocumentID) {
        docs.push(obj);
      }
    })
    return docs;
  }

  setVisitDocsArray(docs, emit) {
    
    this.visitAttachments = docs;
    
    if(emit) {
      this.outputDocs.emit(this.visitAttachments);
    }
    this.updateImageViewer();
  }

  updateVisitDocsArray(docs, emit) {
    
    this.visitAttachments = [...this.visitAttachments, ...docs];
    
    if(emit) {
      this.outputDocs.emit(this.visitAttachments);
    }
    this.updateImageViewer();
  }

  layoutBtnAllowed(btnName) {
    return this.layoutButtons.indexOf(btnName) > -1;
  }

  reEvaluateEditingPermissions() {
    this.editing = {... this.defaultEditing, ...this.editing};
  }


  initImageViewer() {
    // setTimeout(() => {
    //   this.imgViewer = new ImgPreviewer('.visit-attachments-container', {
    //     scrollbar: true
    //   });
    // }, 500);
  }
  updateImageViewer() {
    // this.initImageViewer();
    // if(this.imgViewer) {
    //   setTimeout(() => {
    //     this.imgViewer.update();
    //   }, 500);
    // } else {
    //   this.initImageViewer();
    // }
  }


  
  /***** WEB SOCKET - MULTI APP *****/
  sendCommand(cmd) {
    this.multiApp.sendCommand(cmd);
  }
  connectToMultiApp(){
    this.multiApp.connectToMultiApp();
  }
  disconnectToMultiApp(){
    this.multiApp.disconnectToMultiApp();
  }
  subscribeFirMultiAppStatus() {
    this.multiApp.multiAppConnectionStatus.subscribe( (status) => {
      this.multiAppConnectionStatus = status;
      setTimeout(() => {
        this.cd.detectChanges();        
      }, 100);
    })
  }
  subscribeForScannedDoc() {
    this.multiApp.scannedDoc.subscribe( (doc) => {
      if(doc) {
        this.updateVisitDocsArray(doc, true);
      } else {
        // this.toastr.warning('no data received from scanner');
      }
    })
  }
  scanImage() {
    this.sendCommand({command:'ScanImage'});
  }
  /***** WEB SOCKET - MULTI APP *****/


}
